import { BlockType } from './types'

/** Structural feature identifiers that MineGenerator can place. */
export type StructuralFeatureId =
  | 'pocket_caves'
  | 'crystal_veins'
  | 'root_corridors'
  | 'lava_streams'
  | 'ice_columns'
  | 'mushroom_clusters'
  | 'fossil_beds'
  | 'obsidian_spires'
  | 'sand_pockets'
  | 'amber_inclusions'
  | 'copper_traces'
  | 'magma_rivers'
  | 'void_columns'
  | 'ruin_walls'
  | 'plasma_nodes'
  | 'temporal_fractures'
  | 'floating_islands'
  | 'mirror_symmetry'
  | 'living_veins'
  | 'glitch_tiles'

/** Configuration for a structural feature placement. */
export interface StructuralFeatureConfig {
  /** Feature identifier */
  id: StructuralFeatureId
  /** Min bounding box for the feature */
  minSize: { width: number; height: number }
  /** Max bounding box for the feature */
  maxSize: { width: number; height: number }
  /** 0.0-1.0: probability of attempting placement per valid zone */
  frequency: number
  /** Block type to fill the feature with (Empty for open areas, specific types for formations) */
  fillBlock: BlockType
}

/** Per-biome structural feature assignments. */
export const BIOME_STRUCTURAL_FEATURES: Record<string, StructuralFeatureId[]> = {
  // Shallow
  limestone_caves: ['pocket_caves', 'fossil_beds'],
  clay_basin: ['pocket_caves', 'sand_pockets'],
  iron_seam: ['crystal_veins', 'copper_traces'],
  root_tangle: ['root_corridors', 'mushroom_clusters'],
  peat_bog: ['pocket_caves', 'amber_inclusions'],
  // Mid
  basalt_maze: ['obsidian_spires', 'lava_streams'],
  salt_flats: ['crystal_veins', 'pocket_caves'],
  coal_veins: ['root_corridors', 'amber_inclusions'],
  granite_canyon: ['pocket_caves', 'crystal_veins'],
  sulfur_springs: ['lava_streams', 'pocket_caves'],
  // Deep
  obsidian_rift: ['obsidian_spires', 'void_columns'],
  magma_shelf: ['magma_rivers', 'lava_streams', 'obsidian_spires'],
  crystal_geode: ['crystal_veins', 'pocket_caves'],
  fossil_layer: ['fossil_beds', 'amber_inclusions'],
  quartz_halls: ['crystal_veins', 'ice_columns'],
  // Extreme
  primordial_mantle: ['magma_rivers', 'lava_streams', 'obsidian_spires'],
  iron_core_fringe: ['crystal_veins', 'obsidian_spires'],
  pressure_dome: ['crystal_veins', 'ice_columns'],
  deep_biolume: ['living_veins', 'mushroom_clusters'],
  tectonic_scar: ['magma_rivers', 'void_columns'],
  // Anomaly
  temporal_rift: ['temporal_fractures', 'glitch_tiles', 'floating_islands'],
  alien_intrusion: ['crystal_veins', 'plasma_nodes'],
  bioluminescent: ['living_veins', 'mushroom_clusters'],
  void_pocket: ['void_columns', 'floating_islands'],
  echo_chamber: ['pocket_caves', 'mirror_symmetry'],
}

/** Feature placement configs with size and frequency parameters. */
export const STRUCTURAL_FEATURE_CONFIGS: Record<StructuralFeatureId, Omit<StructuralFeatureConfig, 'id'>> = {
  pocket_caves: { minSize: { width: 3, height: 3 }, maxSize: { width: 5, height: 5 }, frequency: 0.15, fillBlock: BlockType.Empty },
  crystal_veins: { minSize: { width: 2, height: 4 }, maxSize: { width: 3, height: 8 }, frequency: 0.12, fillBlock: BlockType.MineralNode },
  root_corridors: { minSize: { width: 6, height: 2 }, maxSize: { width: 10, height: 3 }, frequency: 0.10, fillBlock: BlockType.Empty },
  lava_streams: { minSize: { width: 1, height: 5 }, maxSize: { width: 2, height: 10 }, frequency: 0.08, fillBlock: BlockType.LavaBlock },
  ice_columns: { minSize: { width: 1, height: 4 }, maxSize: { width: 2, height: 8 }, frequency: 0.10, fillBlock: BlockType.HardRock },
  mushroom_clusters: { minSize: { width: 2, height: 3 }, maxSize: { width: 3, height: 4 }, frequency: 0.12, fillBlock: BlockType.SoftRock },
  fossil_beds: { minSize: { width: 5, height: 2 }, maxSize: { width: 8, height: 3 }, frequency: 0.10, fillBlock: BlockType.FossilNode },
  obsidian_spires: { minSize: { width: 1, height: 3 }, maxSize: { width: 2, height: 6 }, frequency: 0.10, fillBlock: BlockType.HardRock },
  sand_pockets: { minSize: { width: 3, height: 2 }, maxSize: { width: 5, height: 4 }, frequency: 0.15, fillBlock: BlockType.Dirt },
  amber_inclusions: { minSize: { width: 2, height: 2 }, maxSize: { width: 3, height: 3 }, frequency: 0.08, fillBlock: BlockType.ArtifactNode },
  copper_traces: { minSize: { width: 2, height: 3 }, maxSize: { width: 3, height: 6 }, frequency: 0.10, fillBlock: BlockType.MineralNode },
  magma_rivers: { minSize: { width: 3, height: 1 }, maxSize: { width: 8, height: 2 }, frequency: 0.08, fillBlock: BlockType.LavaBlock },
  void_columns: { minSize: { width: 1, height: 4 }, maxSize: { width: 2, height: 8 }, frequency: 0.10, fillBlock: BlockType.Empty },
  ruin_walls: { minSize: { width: 3, height: 3 }, maxSize: { width: 5, height: 5 }, frequency: 0.08, fillBlock: BlockType.UnstableGround },
  plasma_nodes: { minSize: { width: 2, height: 2 }, maxSize: { width: 3, height: 3 }, frequency: 0.10, fillBlock: BlockType.GasPocket },
  temporal_fractures: { minSize: { width: 1, height: 3 }, maxSize: { width: 2, height: 6 }, frequency: 0.10, fillBlock: BlockType.Empty },
  floating_islands: { minSize: { width: 3, height: 3 }, maxSize: { width: 4, height: 4 }, frequency: 0.08, fillBlock: BlockType.Stone },
  mirror_symmetry: { minSize: { width: 4, height: 4 }, maxSize: { width: 6, height: 6 }, frequency: 0.05, fillBlock: BlockType.Stone },
  living_veins: { minSize: { width: 2, height: 4 }, maxSize: { width: 3, height: 8 }, frequency: 0.10, fillBlock: BlockType.MineralNode },
  glitch_tiles: { minSize: { width: 2, height: 2 }, maxSize: { width: 4, height: 4 }, frequency: 0.12, fillBlock: BlockType.DataDisc },
}
