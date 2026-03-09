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
  Empty       = 0,
  SkyStars    = 1,
  InteriorWall = 2,
  DirtGround  = 3,
  StoneWall   = 4,
  CrystalWall = 5,
}

/**
 * Foreground / structural tile types for a floor.
 * Forms the floor surface, walls, glass panels, and structural elements.
 */
export enum FloorFgTile {
  Empty         = 0,
  GlassWall     = 1,
  MetalFrame    = 2,
  StoneFloor    = 3,
  MetalGrate    = 4,
  GlassCeiling  = 5,
  WoodPlanks    = 6,
  CrystalFloor  = 7,
}

/** Visual upgrade tier for a floor. 0 = bare scaffolding, 3 = premium. */
export type FloorUpgradeTier = 0 | 1 | 2 | 3

/** A single interactive or decorative object placed on a floor grid. */
export interface FloorObject {
  id: string
  spriteKey: string
  label: string
  action: string
  gridX: number
  gridY: number
  gridW: number
  gridH: number
  interactive: boolean
  minTier?: FloorUpgradeTier
}

/** A purchasable wallpaper applied to a specific floor. */
export interface FloorWallpaper {
  id: string
  label: string
  dustCost: number
  premiumCost: number | null
}

/** Unlock requirements for a floor. ALL non-null conditions must be satisfied. */
export interface FloorUnlockRequirement {
  divesCompleted?: number
  factsLearned?: number
  factsMastered?: number
  deepestLayer?: number
  dustCost?: number
  prerequisiteFloorIds?: string[]
}

/** A single floor in the hub stack. */
export interface HubFloor {
  id: string
  name: string
  description: string
  theme: 'sci-fi' | 'organic' | 'crystal' | 'observatory' | 'archive' | 'market' | 'industrial' | 'gallery'
  stackIndex: number
  bg: FloorBgTile[][]
  fg: FloorFgTile[][]
  objects: FloorObject[]
  unlockRequirements: FloorUnlockRequirement | null
  availableWallpapers: string[]
}

/** The complete hub stack. */
export interface HubStack {
  floors: HubFloor[]
}

/** Per-save state for the hub, stored in PlayerSave.hubState. */
export interface HubSaveState {
  unlockedFloorIds: string[]
  activeWallpapers: Record<string, string | null>
  floorTiers: Record<string, FloorUpgradeTier>
  lastBriefingDate: string | null
  /** Whether the player has completed their first full dome tour. Used to trigger Dust Cat unlock. */
  firstDomeTourComplete?: boolean
}

/** Creates a 2D grid initialized to a fill value. */
export function createFloorGrid<T>(cols: number, rows: number, fill: T): T[][] {
  return Array.from({ length: rows }, () => Array<T>(cols).fill(fill))
}

/** Fills a rectangular region of a grid with a value. Clamps to grid bounds. */
export function fillRect<T>(
  grid: T[][],
  colStart: number,
  rowStart: number,
  colEnd: number,
  rowEnd: number,
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

/** Returns default HubSaveState for new players. */
export function defaultHubSaveState(): HubSaveState {
  return {
    unlockedFloorIds: ['starter', 'study', 'farm', 'workshop', 'zoo', 'collection', 'market', 'research', 'observatory', 'gallery'],
    activeWallpapers: {},
    floorTiers: { starter: 0, study: 0, farm: 0, workshop: 0, zoo: 0, collection: 0, market: 0, research: 0, observatory: 0, gallery: 0 },
    lastBriefingDate: null,
  }
}
