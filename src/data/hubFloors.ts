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

// Floor 0: Starter Hub
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
      { id: 'dive_hatch', spriteKey: 'obj_dive_hatch', label: 'Mine Entrance', action: 'dive', gridX: 44, gridY: 38, gridW: 14, gridH: 7, interactive: true },
      { id: 'gaia_terminal', spriteKey: 'obj_gaia_terminal', label: 'G.A.I.A. Terminal', action: 'command', gridX: 10, gridY: 30, gridW: 10, gridH: 15, interactive: true },
      { id: 'knowledge_tree', spriteKey: 'obj_knowledge_tree_stage0', label: 'Knowledge Tree', action: 'knowledgeTree', gridX: 22, gridY: 28, gridW: 12, gridH: 17, interactive: true },
      { id: 'workbench', spriteKey: 'obj_workbench', label: 'Materializer', action: 'workshop', gridX: 70, gridY: 32, gridW: 13, gridH: 13, interactive: true },
      { id: 'streak_board', spriteKey: 'obj_streak_board', label: 'Streak Board', action: 'streakPanel', gridX: 84, gridY: 35, gridW: 6, gridH: 10, interactive: true },
      { id: 'decorator', spriteKey: 'obj_decorator', label: 'Decorator', action: 'decorator', gridX: 3, gridY: 32, gridW: 8, gridH: 13, interactive: true },
      { id: 'study_desk', spriteKey: 'obj_study_alcove', label: 'Study Desk', action: 'studySession', gridX: 36, gridY: 32, gridW: 8, gridH: 13, interactive: true },
      { id: 'artifact_lab', spriteKey: 'obj_display_case', label: 'Artifact Lab', action: 'reviewArtifact', gridX: 60, gridY: 32, gridW: 10, gridH: 13, interactive: true },
    ],
    unlockRequirements: null,
    availableWallpapers: ['wallpaper_nebula', 'wallpaper_aurora', 'wallpaper_deep_space'],
  }
}

// Floor 1: The Farm
function makeFarmFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.WoodPlanks)
  fillRect(bg, 1, 40, 94, 44, FloorBgTile.DirtGround)
  return {
    id: 'farm', name: 'The Farm',
    description: 'Hydroponic growing chambers. Seeds from the surface can be cultivated underground.',
    theme: 'organic', stackIndex: 1, bg, fg,
    objects: [
      { id: 'farm_plot_1', spriteKey: 'obj_farm_plot', label: 'Hydroponic Bay A', action: 'farm', gridX: 5, gridY: 34, gridW: 20, gridH: 10, interactive: true },
      { id: 'farm_plot_2', spriteKey: 'obj_farm_plot', label: 'Hydroponic Bay B', action: 'farm', gridX: 28, gridY: 34, gridW: 20, gridH: 10, interactive: true, minTier: 1 },
      { id: 'seed_station', spriteKey: 'obj_seed_station', label: 'Seed Station', action: 'farm', gridX: 68, gridY: 30, gridW: 12, gridH: 15, interactive: true },
    ],
    unlockRequirements: { divesCompleted: 3, factsLearned: 10, dustCost: 500 },
    availableWallpapers: ['wallpaper_meadow', 'wallpaper_forest', 'wallpaper_greenhouse'],
  }
}

// Floor 2: Workshop
function makeWorkshopFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.StoneWall, FloorFgTile.MetalGrate)
  return {
    id: 'workshop', name: 'Workshop',
    description: 'Advanced fabrication suite. Craft powerful consumables and permanent upgrades.',
    theme: 'industrial', stackIndex: 2, bg, fg,
    objects: [
      { id: 'premium_materializer', spriteKey: 'obj_premium_workbench', label: 'Premium Materializer', action: 'premiumMaterializer', gridX: 8, gridY: 28, gridW: 16, gridH: 17, interactive: true },
      { id: 'upgrade_anvil', spriteKey: 'obj_upgrade_anvil', label: 'Upgrade Anvil', action: 'workshop', gridX: 38, gridY: 30, gridW: 14, gridH: 15, interactive: true, minTier: 1 },
      { id: 'blueprint_board', spriteKey: 'obj_blueprint_board', label: 'Blueprint Board', action: 'workshop', gridX: 68, gridY: 20, gridW: 14, gridH: 15, interactive: true },
    ],
    unlockRequirements: { divesCompleted: 10, factsLearned: 30, dustCost: 2000, prerequisiteFloorIds: ['farm'] },
    availableWallpapers: ['wallpaper_industrial', 'wallpaper_blueprint', 'wallpaper_lava_forge'],
  }
}

// Floor 3: The Zoo
function makeZooFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.DirtGround, FloorFgTile.StoneFloor)
  return {
    id: 'zoo', name: 'The Zoo',
    description: 'Fossil revival chambers. Revived companions live and roam here between dives.',
    theme: 'organic', stackIndex: 3, bg, fg,
    objects: [
      { id: 'companion_habitat', spriteKey: 'obj_fossil_tank', label: 'Companion Habitat', action: 'zoo', gridX: 5, gridY: 22, gridW: 30, gridH: 23, interactive: true },
      { id: 'fossil_display', spriteKey: 'obj_fossil_display', label: 'Fossil Gallery', action: 'fossilGallery', gridX: 60, gridY: 28, gridW: 16, gridH: 17, interactive: true },
      { id: 'feeding_station', spriteKey: 'obj_feeding_station', label: 'Feeding Station', action: 'zoo', gridX: 78, gridY: 32, gridW: 10, gridH: 13, interactive: true, minTier: 1 },
    ],
    unlockRequirements: { divesCompleted: 15, factsLearned: 50, factsMastered: 5, dustCost: 3000, prerequisiteFloorIds: ['farm'] },
    availableWallpapers: ['wallpaper_savanna', 'wallpaper_ocean', 'wallpaper_jungle'],
  }
}

// Floor 4: Museum
function makeMuseumFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'museum', name: 'Museum',
    description: 'Artifacts and relics from your dives, displayed with pride.',
    theme: 'archive', stackIndex: 4, bg, fg,
    objects: [
      { id: 'display_case_a', spriteKey: 'obj_display_case', label: 'Relic Display A', action: 'museum', gridX: 6, gridY: 26, gridW: 14, gridH: 19, interactive: true },
      { id: 'display_case_b', spriteKey: 'obj_display_case', label: 'Relic Display B', action: 'museum', gridX: 30, gridY: 26, gridW: 14, gridH: 19, interactive: true, minTier: 1 },
      { id: 'achievement_wall', spriteKey: 'obj_achievement_wall', label: 'Achievement Wall', action: 'museum', gridX: 62, gridY: 16, gridW: 20, gridH: 18, interactive: true },
    ],
    unlockRequirements: { divesCompleted: 20, factsLearned: 75, dustCost: 5000, prerequisiteFloorIds: ['zoo'] },
    availableWallpapers: ['wallpaper_marble', 'wallpaper_antiquity', 'wallpaper_hall_of_fame'],
  }
}

// Floor 5: Market
function makeMarketFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall)
  return {
    id: 'market', name: 'Market',
    description: 'Daily deals, cosmetics, and wallpapers. The merchant changes stock every 24 hours.',
    theme: 'market', stackIndex: 5, bg, fg,
    objects: [
      { id: 'market_stall', spriteKey: 'obj_market_stall', label: 'Daily Deals', action: 'market', gridX: 8, gridY: 24, gridW: 16, gridH: 21, interactive: true },
      { id: 'cosmetics_vendor', spriteKey: 'obj_cosmetics_vendor', label: 'Cosmetics Shop', action: 'cosmeticsShop', gridX: 40, gridY: 24, gridW: 16, gridH: 21, interactive: true },
      { id: 'wallpaper_shop', spriteKey: 'obj_wallpaper_kiosk', label: 'Wallpaper Shop', action: 'wallpaperShop', gridX: 70, gridY: 28, gridW: 14, gridH: 17, interactive: true, minTier: 1 },
    ],
    unlockRequirements: { divesCompleted: 25, factsLearned: 100, dustCost: 4000, prerequisiteFloorIds: ['museum'] },
    availableWallpapers: ['wallpaper_bazaar', 'wallpaper_neon_market', 'wallpaper_crystal_arcade'],
  }
}

// Floor 6: Research Lab
function makeResearchFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.CrystalWall, FloorFgTile.CrystalFloor)
  return {
    id: 'research', name: 'Research Lab',
    description: 'Convert knowledge into power. Houses the Knowledge Store and Data Disc reader.',
    theme: 'crystal', stackIndex: 6, bg, fg,
    objects: [
      { id: 'knowledge_store_terminal', spriteKey: 'obj_knowledge_store', label: 'Knowledge Store', action: 'knowledgeStore', gridX: 6, gridY: 22, gridW: 18, gridH: 23, interactive: true },
      { id: 'data_disc_reader', spriteKey: 'obj_data_disc_reader', label: 'Data Disc Reader', action: 'dataDisc', gridX: 40, gridY: 26, gridW: 14, gridH: 19, interactive: true },
      { id: 'experiment_bench', spriteKey: 'obj_experiment_bench', label: 'Experiment Bench', action: 'research', gridX: 68, gridY: 26, gridW: 16, gridH: 19, interactive: true, minTier: 2 },
    ],
    unlockRequirements: { divesCompleted: 35, factsLearned: 150, factsMastered: 25, dustCost: 8000, prerequisiteFloorIds: ['market'] },
    availableWallpapers: ['wallpaper_crystal_cave', 'wallpaper_bioluminescent', 'wallpaper_void'],
  }
}

// Floor 7: Archive
function makeArchiveFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.CrystalWall)
  return {
    id: 'archive', name: 'Archive',
    description: "G.A.I.A.'s full report lives here. Review your learning analytics and history.",
    theme: 'archive', stackIndex: 7, bg, fg,
    objects: [
      { id: 'bookshelf', spriteKey: 'obj_bookshelf', label: 'Knowledge Archive', action: 'archive', gridX: 4, gridY: 14, gridW: 20, gridH: 31, interactive: true },
      { id: 'gaia_report_terminal', spriteKey: 'obj_gaia_report', label: 'G.A.I.A. Report', action: 'gaiaReport', gridX: 38, gridY: 22, gridW: 18, gridH: 23, interactive: true },
      { id: 'study_alcove', spriteKey: 'obj_study_alcove', label: 'Study Alcove', action: 'studySession', gridX: 68, gridY: 26, gridW: 16, gridH: 19, interactive: true },
    ],
    unlockRequirements: { divesCompleted: 50, factsLearned: 250, factsMastered: 50, dustCost: 12000, prerequisiteFloorIds: ['research'] },
    availableWallpapers: ['wallpaper_library', 'wallpaper_scriptorium', 'wallpaper_ancient_texts'],
  }
}

// Floor 8: Observatory
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
    id: 'observatory', name: 'Observatory',
    description: 'A glass-domed stargazing chamber at the top of the hub. The pinnacle of your journey.',
    theme: 'observatory', stackIndex: 8, bg, fg,
    objects: [
      { id: 'telescope', spriteKey: 'obj_telescope', label: 'Star Telescope', action: 'observatory', gridX: 38, gridY: 20, gridW: 20, gridH: 25, interactive: true },
      { id: 'streak_shrine', spriteKey: 'obj_streak_shrine', label: 'Streak Shrine', action: 'streakPanel', gridX: 10, gridY: 28, gridW: 14, gridH: 17, interactive: true },
      { id: 'star_map', spriteKey: 'obj_star_map', label: 'Star Map', action: 'observatory', gridX: 70, gridY: 22, gridW: 16, gridH: 21, interactive: true, minTier: 2 },
    ],
    unlockRequirements: { divesCompleted: 75, factsLearned: 400, factsMastered: 100, deepestLayer: 15, dustCost: 20000, prerequisiteFloorIds: ['archive'] },
    availableWallpapers: ['wallpaper_cosmos', 'wallpaper_aurora_borealis', 'wallpaper_supernova'],
  }
}

// Floor 9: Achievement Gallery
function makeGalleryFloor(): HubFloor {
  const { bg, fg } = buildStandardGrids(FloorBgTile.InteriorWall, FloorFgTile.WoodPlanks)

  // Thicker inner wall texture — fill rows 3-10 to create a gallery frieze
  fillRect(bg, 1, 3, 94, 10, FloorBgTile.StoneWall)

  return {
    id: 'gallery',
    name: 'Achievement Gallery',
    description: "G.A.I.A.'s permanent record of your journey. Each painting marks a milestone you will never forget.",
    theme: 'gallery',
    stackIndex: 9,
    bg,
    fg,
    objects: [
      // Five painting frames on the left wall
      { id: 'frame_01', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 4,  gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_02', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 18, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_03', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 32, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_04', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 46, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_05', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 60, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_06', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 74, gridY: 12, gridW: 12, gridH: 14, interactive: true },
      // Six painting frames on the lower register
      { id: 'frame_07', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 4,  gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_08', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 18, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_09', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 32, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_10', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 46, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_11', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 60, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      { id: 'frame_12', spriteKey: 'obj_gallery_frame', label: 'Painting', action: 'galleryPainting', gridX: 74, gridY: 28, gridW: 12, gridH: 14, interactive: true },
      // Placard near entry
      { id: 'gallery_entry', spriteKey: 'obj_achievement_wall', label: 'Gallery Overview', action: 'galleryOverview', gridX: 42, gridY: 38, gridW: 12, gridH: 7, interactive: true },
    ],
    unlockRequirements: {
      divesCompleted: 50,
      factsLearned: 250,
      factsMastered: 50,
      dustCost: 15000,
      prerequisiteFloorIds: ['archive'],
    },
    availableWallpapers: ['wallpaper_marble', 'wallpaper_hall_of_fame', 'wallpaper_antiquity'],
  }
}

/** Returns the complete hub stack with all 10 canonical floors. */
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
      makeGalleryFloor(),  // Phase 47: floor index 9
    ],
  }
}
