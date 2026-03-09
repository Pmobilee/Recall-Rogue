import {
  FLOOR_COLS, FLOOR_ROWS,
  FloorBgTile, FloorFgTile,
  createFloorGrid, fillRect,
  type HubFloor, type HubStack,
} from './hubLayout'

/**
 * Builds bg and fg grids for a floor with standard glass-box structure.
 * @param bgFill - Background tile to fill the interior (rows 3-44, cols 1-94).
 * @param floorTile - Tile type for the walkable floor surface (rows 45-46).
 */
function buildStandardGrids(
  bgFill: FloorBgTile,
  floorTile: FloorFgTile = FloorFgTile.StoneFloor,
): { bg: FloorBgTile[][], fg: FloorFgTile[][] } {
  const bg = createFloorGrid<FloorBgTile>(FLOOR_COLS, FLOOR_ROWS, FloorBgTile.Empty)
  const fg = createFloorGrid<FloorFgTile>(FLOOR_COLS, FLOOR_ROWS, FloorFgTile.Empty)

  // Interior background fill
  fillRect(bg, 1, 3, 94, 44, bgFill)

  // Outer metal frame border
  fillRect(fg, 0, 0, 95, 0, FloorFgTile.MetalFrame)    // top
  fillRect(fg, 0, 47, 95, 47, FloorFgTile.MetalFrame)  // bottom
  fillRect(fg, 0, 0, 0, 47, FloorFgTile.MetalFrame)    // left
  fillRect(fg, 95, 0, 95, 47, FloorFgTile.MetalFrame)  // right

  // Glass top pane (rows 1-2)
  fillRect(fg, 1, 1, 94, 2, FloorFgTile.GlassWall)

  // Walkable floor (rows 45-46)
  fillRect(fg, 1, 45, 94, 46, floorTile)

  // Ladder shaft opening (cols 44-51)
  fillRect(fg, 44, 45, 51, 46, FloorFgTile.Empty)

  return { bg, fg }
}

function makeStarterFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'starter',
    name: 'Base Camp',
    description: 'Your crash-landing site. G.A.I.A. has set up a basic operations center here.',
    theme: 'sci-fi',
    stackIndex: 0,
    bg, fg,
    objects: [
      { id: 'dive_hatch', spriteKey: '', label: 'Mine Entrance', action: 'dive', gridX: 39, gridY: 37, gridW: 18, gridH: 8, interactive: true },
      { id: 'artifact_lab', spriteKey: '', label: 'Artifact Lab', action: 'reviewArtifact', gridX: 5, gridY: 33, gridW: 14, gridH: 12, interactive: true },
      { id: 'workbench', spriteKey: '', label: 'Materializer', action: 'materializer', gridX: 60, gridY: 33, gridW: 12, gridH: 12, interactive: true },
      { id: 'gaia_terminal', spriteKey: '', label: 'G.A.I.A. Terminal', action: 'command', gridX: 78, gridY: 31, gridW: 10, gridH: 14, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_nebula', 'wallpaper_aurora', 'wallpaper_deep_space'],
  }
}

function makeStudyFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'study',
    name: 'Study Hall',
    description: 'A quiet space for focused learning. The Knowledge Tree grows here.',
    theme: 'archive',
    stackIndex: 1,
    bg, fg,
    objects: [
      { id: 'knowledge_tree', spriteKey: '', label: 'Knowledge Tree', action: 'knowledgeTree', gridX: 38, gridY: 25, gridW: 14, gridH: 20, interactive: true },
      { id: 'study_desk', spriteKey: '', label: 'Study Desk', action: 'studySession', gridX: 5, gridY: 35, gridW: 14, gridH: 10, interactive: true },
      { id: 'streak_board', spriteKey: '', label: 'Streak Board', action: 'streakPanel', gridX: 78, gridY: 33, gridW: 8, gridH: 12, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_library', 'wallpaper_scriptorium', 'wallpaper_ancient_texts'],
  }
}

function makeFarmFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.WoodPlanks)
  fillRect(bg, 1, 40, 94, 44, FloorBgTile.DirtGround)
  return {
    id: 'farm',
    name: 'The Farm',
    description: 'Hydroponic growing chambers. Seeds from the surface can be cultivated underground.',
    theme: 'organic',
    stackIndex: 2,
    bg, fg,
    objects: [
      { id: 'farm_plot_1', spriteKey: '', label: 'Hydroponic Bay A', action: 'farm', gridX: 5, gridY: 37, gridW: 22, gridH: 8, interactive: true },
      { id: 'farm_plot_2', spriteKey: '', label: 'Hydroponic Bay B', action: 'farm', gridX: 30, gridY: 37, gridW: 22, gridH: 8, interactive: true },
      { id: 'seed_station', spriteKey: '', label: 'Seed Station', action: 'farm', gridX: 72, gridY: 33, gridW: 10, gridH: 12, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_meadow', 'wallpaper_forest', 'wallpaper_greenhouse'],
  }
}

function makeWorkshopFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.StoneWall, FloorFgTile.MetalGrate)
  return {
    id: 'workshop',
    name: 'Workshop',
    description: 'Advanced fabrication suite. Craft powerful consumables and permanent upgrades.',
    theme: 'industrial',
    stackIndex: 3,
    bg, fg,
    objects: [
      { id: 'premium_materializer', spriteKey: '', label: 'Premium Materializer', action: 'premiumMaterializer', gridX: 5, gridY: 31, gridW: 16, gridH: 14, interactive: true },
      { id: 'upgrade_anvil', spriteKey: '', label: 'Upgrade Anvil', action: 'workshop', gridX: 38, gridY: 33, gridW: 12, gridH: 12, interactive: true },
      { id: 'blueprint_board', spriteKey: '', label: 'Blueprint Board', action: 'workshop', gridX: 70, gridY: 35, gridW: 14, gridH: 10, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_industrial', 'wallpaper_blueprint', 'wallpaper_lava_forge'],
  }
}

function makeZooFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.StoneFloor)
  return {
    id: 'zoo',
    name: 'Companions',
    description: 'Fossil revival chambers. Revived companions live and roam here between dives.',
    theme: 'organic',
    stackIndex: 4,
    bg, fg,
    objects: [
      { id: 'companion_habitat', spriteKey: '', label: 'Companion Habitat', action: 'zoo', gridX: 5, gridY: 27, gridW: 26, gridH: 18, interactive: true },
      { id: 'fossil_display', spriteKey: '', label: 'Fossil Gallery', action: 'fossilGallery', gridX: 55, gridY: 31, gridW: 16, gridH: 14, interactive: true },
      { id: 'feeding_station', spriteKey: '', label: 'Feeding Station', action: 'zoo', gridX: 78, gridY: 35, gridW: 10, gridH: 10, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_savanna', 'wallpaper_ocean', 'wallpaper_jungle'],
  }
}

function makeCollectionFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'collection',
    name: 'Collection Hall',
    description: 'Achievements, decorations, and cosmetics displayed with pride.',
    theme: 'archive',
    stackIndex: 5,
    bg, fg,
    objects: [
      { id: 'achievement_wall', spriteKey: '', label: 'Achievement Wall', action: 'museum', gridX: 5, gridY: 31, gridW: 20, gridH: 14, interactive: true },
      { id: 'decorator', spriteKey: '', label: 'Decorator', action: 'decorator', gridX: 35, gridY: 33, gridW: 10, gridH: 12, interactive: true },
      { id: 'cosmetics_vendor', spriteKey: '', label: 'Cosmetics Shop', action: 'cosmeticsShop', gridX: 65, gridY: 31, gridW: 14, gridH: 14, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_marble', 'wallpaper_antiquity', 'wallpaper_hall_of_fame'],
  }
}

function makeMarketFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'market',
    name: 'Market',
    description: 'Daily deals, knowledge store, and wallpapers. The merchant changes stock every 24 hours.',
    theme: 'market',
    stackIndex: 6,
    bg, fg,
    objects: [
      { id: 'market_stall', spriteKey: '', label: 'Daily Deals', action: 'market', gridX: 5, gridY: 29, gridW: 18, gridH: 16, interactive: true },
      { id: 'knowledge_store_terminal', spriteKey: '', label: 'Knowledge Store', action: 'knowledgeStore', gridX: 35, gridY: 31, gridW: 16, gridH: 14, interactive: true },
      { id: 'wallpaper_shop', spriteKey: '', label: 'Wallpaper Shop', action: 'wallpaperShop', gridX: 70, gridY: 33, gridW: 10, gridH: 12, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_bazaar', 'wallpaper_neon_market', 'wallpaper_crystal_arcade'],
  }
}

function makeResearchFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.CrystalWall, FloorFgTile.CrystalFloor)
  return {
    id: 'research',
    name: 'Archive & Research',
    description: 'G.A.I.A.\'s full knowledge archive, experiment bench, and data disc reader.',
    theme: 'crystal',
    stackIndex: 7,
    bg, fg,
    objects: [
      { id: 'bookshelf', spriteKey: '', label: 'Knowledge Archive', action: 'archive', gridX: 5, gridY: 23, gridW: 18, gridH: 22, interactive: true },
      { id: 'gaia_report_terminal', spriteKey: '', label: 'G.A.I.A. Report', action: 'gaiaReport', gridX: 30, gridY: 29, gridW: 14, gridH: 16, interactive: true },
      { id: 'experiment_bench', spriteKey: '', label: 'Experiment Bench', action: 'research', gridX: 55, gridY: 33, gridW: 16, gridH: 12, interactive: true },
      { id: 'data_disc_reader', spriteKey: '', label: 'Data Disc Reader', action: 'dataDisc', gridX: 78, gridY: 33, gridW: 10, gridH: 12, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_crystal_cave', 'wallpaper_bioluminescent', 'wallpaper_void'],
  }
}

function makeObservatoryFloor(): HubFloor {
  const bg = createFloorGrid<FloorBgTile>(FLOOR_COLS, FLOOR_ROWS, FloorBgTile.SkyStars)
  const fg = createFloorGrid<FloorFgTile>(FLOOR_COLS, FLOOR_ROWS, FloorFgTile.Empty)
  fillRect(fg, 0, 0, 95, 0, FloorFgTile.MetalFrame)
  fillRect(fg, 0, 47, 95, 47, FloorFgTile.MetalFrame)
  fillRect(fg, 0, 0, 0, 47, FloorFgTile.MetalFrame)
  fillRect(fg, 95, 0, 95, 47, FloorFgTile.MetalFrame)
  fillRect(fg, 1, 1, 94, 6, FloorFgTile.GlassCeiling)
  fillRect(fg, 1, 45, 94, 46, FloorFgTile.StoneFloor)
  return {
    id: 'observatory',
    name: 'Observatory',
    description: 'A glass-domed stargazing chamber at the top of the hub. The pinnacle of your journey.',
    theme: 'observatory',
    stackIndex: 8,
    bg, fg,
    objects: [
      { id: 'telescope', spriteKey: '', label: 'Star Telescope', action: 'observatory', gridX: 30, gridY: 23, gridW: 16, gridH: 22, interactive: true },
      { id: 'star_map', spriteKey: '', label: 'Star Map', action: 'observatory', gridX: 60, gridY: 31, gridW: 18, gridH: 14, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_cosmos', 'wallpaper_aurora_borealis', 'wallpaper_supernova'],
  }
}

function makeGalleryFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall, FloorFgTile.WoodPlanks)
  fillRect(bg, 1, 3, 94, 10, FloorBgTile.StoneWall)
  return {
    id: 'gallery',
    name: 'Achievement Gallery',
    description: "G.A.I.A.'s permanent record of your journey. Each painting marks a milestone you will never forget.",
    theme: 'gallery',
    stackIndex: 9,
    bg, fg,
    objects: [
      { id: 'frame_01', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 4, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_02', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 18, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_03', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 32, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_04', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 46, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_05', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 60, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_06', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 74, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_07', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 4, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_08', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 18, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_09', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 32, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_10', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 46, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_11', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 60, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_12', spriteKey: '', label: 'Painting', action: 'galleryPainting', gridX: 74, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'gallery_entry', spriteKey: '', label: 'Gallery Overview', action: 'galleryOverview', gridX: 42, gridY: 38, gridW: 12, gridH: 7, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_marble', 'wallpaper_hall_of_fame', 'wallpaper_antiquity'],
  }
}

/** Returns the complete hub stack with all 10 canonical floors. */
export function getDefaultHubStack(): HubStack {
  return {
    floors: [
      makeGalleryFloor(),
      makeObservatoryFloor(),
      makeResearchFloor(),
      makeMarketFloor(),
      makeCollectionFloor(),
      makeZooFloor(),
      makeWorkshopFloor(),
      makeFarmFloor(),
      makeStudyFloor(),
      makeStarterFloor(),
    ],
  }
}
