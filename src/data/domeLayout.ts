/**
 * domeLayout.ts
 *
 * Data model and default layout for the Terraria-style tile-based dome hub.
 * The dome is a 2D grid with four layers: sky background, background wall,
 * foreground structure, and interactive objects.
 *
 * Grid: 192 columns × 128 rows, each tile rendered at TILE_SIZE pixels.
 * Canvas: 192 × 4 = 768px wide, 128 × 4 = 512px tall (same as before).
 * The 8× finer grid allows smooth elliptical dome curves.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base tile size in logical pixels (lo-res mode). Hi-res scales this up. */
export const TILE_SIZE = 4

/** Dome grid dimensions. */
export const DOME_WIDTH = 192
export const DOME_HEIGHT = 128

// ---------------------------------------------------------------------------
// Dome geometry constants (used by DomeCanvas for procedural rendering)
// ---------------------------------------------------------------------------

/** Dome centre column. */
export const DOME_CX = 96
/** Dome apex row (top of arch). */
export const DOME_APEX = 12
/** Dome base row (bottom of arch / main floor top). */
export const DOME_BASE = 80
/** Half-width of dome ellipse in tiles. */
export const DOME_A = 72
/** Half-height of dome ellipse in tiles (DOME_BASE - DOME_APEX). */
export const DOME_B = 68
/** Leftmost dome column (inclusive). */
export const DOME_LEFT = 24
/** Rightmost dome column (exclusive). */
export const DOME_RIGHT = 168
/** First row of upper catwalk platforms. */
export const UPPER_CATWALK_TOP = 52
/** Last row of upper catwalk platforms. */
export const UPPER_CATWALK_BOT = 55
/** First column of left catwalk wing. */
export const LEFT_WING_START = 32
/** Last column of left catwalk wing (inclusive). */
export const LEFT_WING_END = 82
/** First column of right catwalk wing. */
export const RIGHT_WING_START = 110
/** Last column of right catwalk wing (inclusive). */
export const RIGHT_WING_END = 160
/** First row of main stone floor. */
export const MAIN_FLOOR_TOP = 76
/** Last row of main stone floor. */
export const MAIN_FLOOR_BOT = 79
/** First row of basement metal platform. */
export const BASEMENT_TOP = 84
/** Last row of basement metal platform. */
export const BASEMENT_BOT = 87
/** First row of dirt/ground region. */
export const DIRT_START = 90
/** First interior column of main floor / basement (DOME_LEFT + 1). */
export const FLOOR_LEFT = 25
/** Last interior column of main floor / basement (DOME_RIGHT - 1, inclusive). */
export const FLOOR_RIGHT = 167
/** Support column spans — three columns wide each. */
export const COL_POSITIONS: Array<{ start: number; end: number }> = [
  { start: 46, end: 48 },   // left column
  { start: 95, end: 97 },   // center column
  { start: 144, end: 146 }, // right column
]

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
 * Dome cross-section (192 cols × 128 rows, TILE_SIZE = 4):
 * Canvas is 768×512 pixels — tile resolution is 4px per tile.
 *
 * Elliptical arch math:
 *   - Center X:     col 96
 *   - Left base:    col 24  (DOME_LEFT = CX - A)
 *   - Right base:   col 168 (DOME_RIGHT = CX + A, exclusive)
 *   - Half-width a: 72 tiles
 *   - Apex row:     row 12
 *   - Base row:     row 80
 *   - Half-height b: 68 tiles (80 - 12)
 *
 * For each column x, dome glass top edge:
 *   y_top = 80 - 68 * sqrt(1 - ((x - 96) / 72)²)
 *
 * Three-level interior layout:
 *   Upper catwalks:  rows 52-55 (MetalPlatform) — left wing cols 32-82, right wing cols 110-160
 *   Main floor:      rows 76-79 (StoneFloor)    — cols 25-167
 *   Basement:        rows 84-87 (MetalPlatform) — cols 25-167
 *
 * Background regions:
 *   Rows   0-7:   Sky everywhere (above dome)
 *   Rows   8-79:  Sky outside ellipse, InteriorWall inside
 *   Rows  80-89:  InteriorWall inside dome frame legs, Sky outside
 *   Rows  90-127: DirtGround everywhere — dome embedded in ground
 *
 * Frame legs run continuously col 24 and col 167 from row 76 down to 127,
 * passing through the dirt (the dome structure is embedded in the earth).
 */
export function getDefaultDomeLayout(): DomeLayout {
  const W = DOME_WIDTH   // 192
  const H = DOME_HEIGHT  // 128

  // Ellipse parameters
  const CX = 96        // dome centre column
  const APEX = 12      // dome apex row
  const BASE = 80      // dome base row (main floor top)
  const A = 72         // half-width in tiles
  const B = BASE - APEX  // half-height in tiles (68)

  // Dome left/right column extents
  const DOME_LEFT = CX - A    // 24
  const DOME_RIGHT = CX + A   // 168 (exclusive right edge)

  // Platform row ranges
  const UPPER_CATWALK_TOP = 52
  const UPPER_CATWALK_BOT = 55
  const MAIN_FLOOR_TOP = 76
  const MAIN_FLOOR_BOT = 79
  const BASEMENT_TOP = 84
  const BASEMENT_BOT = 87
  const DIRT_START = 90

  // Upper catwalk column spans
  const LEFT_WING_START = 32
  const LEFT_WING_END = 82   // inclusive
  const RIGHT_WING_START = 110
  const RIGHT_WING_END = 160  // inclusive

  // Support column column spans (3 tiles wide each)
  const COL_LEFT_START = 46
  const COL_LEFT_END = 48
  const COL_CENTER_START = 95
  const COL_CENTER_END = 97
  const COL_RIGHT_START = 144
  const COL_RIGHT_END = 146

  // Main floor / basement interior span
  const FLOOR_LEFT = DOME_LEFT + 1   // 25
  const FLOOR_RIGHT = DOME_RIGHT - 1  // 167 (inclusive)

  // --- Background layer ---------------------------------------------------
  const bg = createEmptyGrid<BgTile>(W, H, BgTile.Empty)

  // Rows 0-7: pure sky above dome
  for (let row = 0; row <= 7; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.Sky
    }
  }

  // Rows 8-79: ellipse-based fill — sky outside dome curve, InteriorWall inside
  for (let col = 0; col < W; col++) {
    const dx = col - CX
    let yTop: number

    if (Math.abs(dx) < A) {
      const ratio = dx / A
      yTop = Math.round(BASE - B * Math.sqrt(1 - ratio * ratio))
    } else {
      yTop = H  // beyond ellipse extent — treat as fully sky
    }

    for (let row = 8; row <= 79; row++) {
      if (row < yTop || col < DOME_LEFT || col >= DOME_RIGHT) {
        bg[row][col] = BgTile.Sky
      } else {
        bg[row][col] = BgTile.InteriorWall
      }
    }
  }

  // Rows 80-89: InteriorWall inside dome legs, Sky outside
  for (let row = 80; row <= 89; row++) {
    for (let col = 0; col < W; col++) {
      if (col >= DOME_LEFT + 1 && col < DOME_RIGHT - 1) {
        bg[row][col] = BgTile.InteriorWall
      } else {
        bg[row][col] = BgTile.Sky
      }
    }
  }

  // Rows 90-127: dirt ground everywhere — dome is embedded in the earth
  for (let row = DIRT_START; row < H; row++) {
    for (let col = 0; col < W; col++) {
      bg[row][col] = BgTile.DirtGround
    }
  }

  // --- Foreground / structure layer ----------------------------------------
  const fg = createEmptyGrid<FgTile>(W, H, FgTile.Empty)

  // Dome glass arch — paint column by column using ellipse formula
  for (let col = DOME_LEFT; col < DOME_RIGHT; col++) {
    const dx = col - CX
    const ratio = dx / A
    const absRatio = Math.abs(ratio)

    if (absRatio >= 1) continue

    const yTop = Math.round(BASE - B * Math.sqrt(1 - ratio * ratio))
    const isApex = yTop <= APEX + 8

    fg[yTop][col] = FgTile.DomeFrame
    if (yTop + 1 < BASE) {
      fg[yTop + 1][col] = isApex ? FgTile.DomeGlassCurved : FgTile.DomeGlass
    }
    if (yTop + 2 < BASE) {
      fg[yTop + 2][col] = isApex ? FgTile.DomeGlassCurved : FgTile.DomeGlass
    }
  }

  // Upper catwalks (rows 52-55, MetalPlatform)
  // Left wing: cols 32-82; right wing: cols 110-160; center gap 83-109 is open atrium
  for (let row = UPPER_CATWALK_TOP; row <= UPPER_CATWALK_BOT; row++) {
    // Left wing
    for (let col = LEFT_WING_START; col <= LEFT_WING_END; col++) {
      fg[row][col] = FgTile.MetalPlatform
    }
    // Right wing
    for (let col = RIGHT_WING_START; col <= RIGHT_WING_END; col++) {
      fg[row][col] = FgTile.MetalPlatform
    }
    // DomeFrame at catwalk outer edges
    fg[row][LEFT_WING_START] = FgTile.DomeFrame
    fg[row][LEFT_WING_END] = FgTile.DomeFrame
    fg[row][RIGHT_WING_START] = FgTile.DomeFrame
    fg[row][RIGHT_WING_END] = FgTile.DomeFrame
  }

  // Internal support columns (DomeFrame, 3 tiles wide each)
  // Left column: cols 46-48, rows 56-75 (connects upper left catwalk to main floor)
  for (let row = UPPER_CATWALK_BOT + 1; row < MAIN_FLOOR_TOP; row++) {
    for (let col = COL_LEFT_START; col <= COL_LEFT_END; col++) {
      fg[row][col] = FgTile.DomeFrame
    }
  }
  // Center column: cols 95-97, rows 20-75 (tall central pillar from near apex to main floor)
  for (let row = 20; row < MAIN_FLOOR_TOP; row++) {
    for (let col = COL_CENTER_START; col <= COL_CENTER_END; col++) {
      fg[row][col] = FgTile.DomeFrame
    }
  }
  // Right column: cols 144-146, rows 56-75 (connects upper right catwalk to main floor)
  for (let row = UPPER_CATWALK_BOT + 1; row < MAIN_FLOOR_TOP; row++) {
    for (let col = COL_RIGHT_START; col <= COL_RIGHT_END; col++) {
      fg[row][col] = FgTile.DomeFrame
    }
  }

  // Main floor (rows 76-79, StoneFloor) — full interior width
  for (let row = MAIN_FLOOR_TOP; row <= MAIN_FLOOR_BOT; row++) {
    for (let col = FLOOR_LEFT; col <= FLOOR_RIGHT; col++) {
      fg[row][col] = FgTile.StoneFloor
    }
    // DomeFrame at left/right edges of floor
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // Basement (rows 84-87, MetalPlatform) — full interior width
  for (let row = BASEMENT_TOP; row <= BASEMENT_BOT; row++) {
    for (let col = FLOOR_LEFT; col <= FLOOR_RIGHT; col++) {
      fg[row][col] = FgTile.MetalPlatform
    }
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // Frame legs — left col 24, right col 167 — run from main floor (row 76) to bottom (row 127)
  // These pass through dirt; the dome structure is embedded in the ground
  for (let row = MAIN_FLOOR_TOP; row < H; row++) {
    fg[row][DOME_LEFT] = FgTile.DomeFrame
    fg[row][DOME_RIGHT - 1] = FgTile.DomeFrame
  }

  // --- Objects layer -------------------------------------------------------
  const objects: DomeObject[] = [

    // ---- Upper left catwalk — research / lab zone ----

    {
      id: 'knowledge_tree',
      spriteKey: 'obj_knowledge_tree',
      label: 'Knowledge Tree',
      room: 'lab',
      gridX: 42,
      gridY: 40,
      gridW: 12,
      gridH: 12,
      interactive: true,
    },
    {
      id: 'wall_monitor_1',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 62,
      gridY: 47,
      gridW: 6,
      gridH: 5,
      interactive: false,
    },

    // ---- Upper right catwalk — archive zone ----

    {
      id: 'bookshelf',
      spriteKey: 'obj_bookshelf',
      label: 'Archive Shelf',
      room: 'archive',
      gridX: 134,
      gridY: 40,
      gridW: 12,
      gridH: 12,
      interactive: true,
    },
    {
      id: 'locked_placeholder',
      spriteKey: 'obj_locked_silhouette',
      label: 'Locked Room',
      room: 'none',
      gridX: 117,
      gridY: 42,
      gridW: 8,
      gridH: 10,
      interactive: false,
    },
    {
      id: 'wall_monitor_2',
      spriteKey: 'deco_wall_monitor',
      label: 'Wall Monitor',
      room: 'none',
      gridX: 154,
      gridY: 47,
      gridW: 6,
      gridH: 5,
      interactive: false,
    },

    // ---- Main floor — command / workshop / market zone ----

    {
      id: 'gaia_terminal',
      spriteKey: 'obj_gaia_terminal',
      label: 'G.A.I.A. Terminal',
      room: 'command',
      gridX: 33,
      gridY: 66,
      gridW: 10,
      gridH: 10,
      interactive: true,
    },
    {
      id: 'streak_board',
      spriteKey: 'obj_streak_board',
      label: 'Streak Board',
      room: 'command',
      gridX: 52,
      gridY: 70,
      gridW: 6,
      gridH: 6,
      interactive: true,
    },
    {
      id: 'display_case',
      spriteKey: 'obj_display_case',
      label: 'Display Case',
      room: 'museum',
      gridX: 77,
      gridY: 66,
      gridW: 10,
      gridH: 10,
      interactive: true,
    },
    {
      id: 'workbench',
      spriteKey: 'obj_workbench',
      label: 'Materializer',
      room: 'workshop',
      gridX: 112,
      gridY: 66,
      gridW: 13,
      gridH: 10,
      interactive: true,
    },
    {
      id: 'market_stall',
      spriteKey: 'obj_market_stall',
      label: 'Market Stall',
      room: 'market',
      gridX: 140,
      gridY: 66,
      gridW: 13,
      gridH: 10,
      interactive: true,
    },

    // ---- Basement — farm and dive hatch ----

    {
      id: 'farm_plot',
      spriteKey: 'obj_farm_plot',
      label: 'Hydroponic Farm',
      room: 'market',
      gridX: 37,
      gridY: 80,
      gridW: 18,
      gridH: 4,
      interactive: true,
    },
    {
      id: 'dive_hatch',
      spriteKey: 'obj_dive_hatch',
      label: 'Mine Entrance',
      room: 'dive',
      gridX: 89,
      gridY: 84,
      gridW: 14,
      gridH: 4,
      interactive: true,
    },

    // ---- Decorations — ceiling lights (6×4 each, clearly visible) ----

    {
      id: 'ceiling_light_1',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 42,
      gridY: 24,
      gridW: 6,
      gridH: 4,
      interactive: false,
    },
    {
      id: 'ceiling_light_2',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 86,
      gridY: 18,
      gridW: 6,
      gridH: 4,
      interactive: false,
    },
    {
      id: 'ceiling_light_3',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 102,
      gridY: 18,
      gridW: 6,
      gridH: 4,
      interactive: false,
    },
    {
      id: 'ceiling_light_4',
      spriteKey: 'deco_ceiling_light',
      label: 'Ceiling Light',
      room: 'none',
      gridX: 152,
      gridY: 24,
      gridW: 6,
      gridH: 4,
      interactive: false,
    },

    // ---- Decorations — plant pots on main floor (5×4 each) ----

    {
      id: 'plant_pot_1',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 68,
      gridY: 72,
      gridW: 5,
      gridH: 4,
      interactive: false,
    },
    {
      id: 'plant_pot_2',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 100,
      gridY: 72,
      gridW: 5,
      gridH: 4,
      interactive: false,
    },
    {
      id: 'plant_pot_3',
      spriteKey: 'deco_plant_pot',
      label: 'Plant Pot',
      room: 'none',
      gridX: 162,
      gridY: 72,
      gridW: 5,
      gridH: 4,
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
