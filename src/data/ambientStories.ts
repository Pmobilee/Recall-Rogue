import { BlockType } from './types';

export interface AmbientStory {
  id: string;
  biome: string;
  triggerBlock?: BlockType;
  text: string;
}

export const AMBIENT_STORIES: AmbientStory[] = [
  // ── Universal (any biome) ─────────────────────────────────────────
  { id: 'amb_01', biome: 'any', text: 'The earth hums a frequency older than language.' },
  { id: 'amb_02', biome: 'any', text: 'Dust motes drift upward, defying gravity for a heartbeat.' },
  { id: 'amb_03', biome: 'any', text: 'Your pick strikes true. The stone remembers.' },
  { id: 'amb_04', biome: 'any', text: 'Somewhere above, wind crosses a dead ocean floor.' },
  { id: 'amb_05', biome: 'any', text: 'The silence here has weight, pressing against your suit.' },
  { id: 'amb_06', biome: 'any', text: 'A faint tremor passes. The planet still breathes.' },
  { id: 'amb_07', biome: 'any', text: 'Your headlamp flickers. Shadows dance on ancient walls.' },
  { id: 'amb_08', biome: 'any', text: 'Each layer deeper is another millennium sealed in stone.' },
  { id: 'amb_09', biome: 'any', text: 'The air tastes of iron and deep time.' },
  { id: 'amb_10', biome: 'any', text: 'You are the first voice in this darkness for eons.' },

  // ── Universal with triggerBlock ────────────────────────────────────
  { id: 'amb_mineral_01', biome: 'any', triggerBlock: BlockType.MineralNode, text: 'The vein catches your light and splits it into colors.' },
  { id: 'amb_mineral_02', biome: 'any', triggerBlock: BlockType.MineralNode, text: 'Crystalline threads run through the rock like frozen veins.' },
  { id: 'amb_fossil_01', biome: 'any', triggerBlock: BlockType.FossilNode, text: 'A shape pressed into stone. Something lived here, once.' },
  { id: 'amb_fossil_02', biome: 'any', triggerBlock: BlockType.FossilNode, text: 'Bone becomes mineral becomes memory becomes dust.' },
  { id: 'amb_artifact_01', biome: 'any', triggerBlock: BlockType.ArtifactNode, text: 'Metal that should not exist at this depth. Human-made.' },
  { id: 'amb_artifact_02', biome: 'any', triggerBlock: BlockType.ArtifactNode, text: 'A relic from the world before. Handle it gently.' },

  // ── Shallow Tier ──────────────────────────────────────────────────
  // limestone_caves
  { id: 'amb_limestone_01', biome: 'limestone_caves', text: 'Water carved these halls over patient millennia.' },
  { id: 'amb_limestone_02', biome: 'limestone_caves', text: 'Stalactites drip in rhythm, counting the centuries.' },
  { id: 'amb_limestone_03', biome: 'limestone_caves', text: 'The chalk-white walls glow faintly in your lamplight.' },
  { id: 'amb_limestone_04', biome: 'limestone_caves', triggerBlock: BlockType.FossilNode, text: 'A shell imprint from when this cave was seafloor.' },

  // clay_basin
  { id: 'amb_clay_01', biome: 'clay_basin', text: 'Red clay clings to your gloves like the earth wants you to stay.' },
  { id: 'amb_clay_02', biome: 'clay_basin', text: 'The walls are soft here. Civilizations were built from this.' },
  { id: 'amb_clay_03', biome: 'clay_basin', text: 'Layers of ochre and sienna stack like a painter\'s palette.' },

  // iron_seam
  { id: 'amb_iron_01', biome: 'iron_seam', text: 'Rust-colored streaks bleed through the rock face.' },
  { id: 'amb_iron_02', biome: 'iron_seam', text: 'Your compass spins lazily. Too much iron in the walls.' },
  { id: 'amb_iron_03', biome: 'iron_seam', triggerBlock: BlockType.MineralNode, text: 'A pure seam of magnetite hums against your pick.' },

  // root_tangle
  { id: 'amb_root_01', biome: 'root_tangle', text: 'Petrified roots twist through stone like frozen rivers.' },
  { id: 'amb_root_02', biome: 'root_tangle', text: 'An ancient forest still grips the earth, even in death.' },
  { id: 'amb_root_03', biome: 'root_tangle', text: 'Root networks map the shape of trees long gone.' },

  // peat_bog
  { id: 'amb_peat_01', biome: 'peat_bog', text: 'The compressed earth smells of old rain and moss.' },
  { id: 'amb_peat_02', biome: 'peat_bog', text: 'Dark layers of peat hold carbon from forgotten skies.' },
  { id: 'amb_peat_03', biome: 'peat_bog', triggerBlock: BlockType.FossilNode, text: 'Something preserved perfectly in the acidic dark.' },

  // ── Mid Tier ──────────────────────────────────────────────────────
  // basalt_maze
  { id: 'amb_basalt_01', biome: 'basalt_maze', text: 'Hexagonal columns stand like the pillars of a buried temple.' },
  { id: 'amb_basalt_02', biome: 'basalt_maze', text: 'Cooled lava froze into geometry too perfect to be natural.' },
  { id: 'amb_basalt_03', biome: 'basalt_maze', text: 'The dark stone absorbs your light. It gives nothing back.' },

  // salt_flats
  { id: 'amb_salt_01', biome: 'salt_flats', text: 'White crystals crunch underfoot. A sea, evaporated and buried.' },
  { id: 'amb_salt_02', biome: 'salt_flats', text: 'The air is dry enough to crack skin. Salt preserves everything.' },
  { id: 'amb_salt_03', biome: 'salt_flats', triggerBlock: BlockType.MineralNode, text: 'A halite cluster refracts your lamp into pale rainbows.' },

  // coal_veins
  { id: 'amb_coal_01', biome: 'coal_veins', text: 'Black seams of compressed forest line the tunnel walls.' },
  { id: 'amb_coal_02', biome: 'coal_veins', text: 'Millions of years of sunlight, locked in carbon.' },
  { id: 'amb_coal_03', biome: 'coal_veins', text: 'The coal face gleams like obsidian under your headlamp.' },

  // granite_canyon
  { id: 'amb_granite_01', biome: 'granite_canyon', text: 'Speckled walls of quartz and feldspar glitter faintly.' },
  { id: 'amb_granite_02', biome: 'granite_canyon', text: 'This granite cooled slowly, deep beneath mountains now gone.' },

  // sulfur_springs
  { id: 'amb_sulfur_01', biome: 'sulfur_springs', text: 'Yellow crusts frame vents that still exhale warm gas.' },
  { id: 'amb_sulfur_02', biome: 'sulfur_springs', text: 'The acrid tang bites through your suit\'s filters.' },
  { id: 'amb_sulfur_03', biome: 'sulfur_springs', text: 'Bacterial mats cling to warmth. Life persists.' },

  // ── Deep Tier ─────────────────────────────────────────────────────
  // obsidian_rift
  { id: 'amb_obsidian_01', biome: 'obsidian_rift', text: 'Glass-smooth walls mirror a distorted version of you.' },
  { id: 'amb_obsidian_02', biome: 'obsidian_rift', text: 'The rift edge is sharp enough to cut light itself.' },

  // magma_shelf
  { id: 'amb_magma_01', biome: 'magma_shelf', text: 'Heat radiates from below. The planet\'s heartbeat, felt as warmth.' },
  { id: 'amb_magma_02', biome: 'magma_shelf', text: 'Cooled magma ripples frozen mid-flow, like a stone river.' },

  // crystal_geode
  { id: 'amb_crystal_01', biome: 'crystal_geode', text: 'You step inside a cathedral of amethyst and silence.' },
  { id: 'amb_crystal_02', biome: 'crystal_geode', triggerBlock: BlockType.MineralNode, text: 'The crystal sings a note too high for human ears.' },
  { id: 'amb_crystal_03', biome: 'crystal_geode', text: 'Prismatic light scatters across your visor in soft arcs.' },

  // fossil_layer
  { id: 'amb_fossillayer_01', biome: 'fossil_layer', text: 'Bones upon bones. A graveyard compressed into geography.' },
  { id: 'amb_fossillayer_02', biome: 'fossil_layer', triggerBlock: BlockType.FossilNode, text: 'A jaw emerges from the stone, mid-roar across epochs.' },
  { id: 'amb_fossillayer_03', biome: 'fossil_layer', text: 'Every slab you lift reveals another chapter of extinction.' },

  // quartz_halls
  { id: 'amb_quartz_01', biome: 'quartz_halls', text: 'Translucent pillars line the passage like frozen sentinels.' },
  { id: 'amb_quartz_02', biome: 'quartz_halls', text: 'Piezoelectric whispers pulse through the quartz matrix.' },

  // ── Extreme Tier ──────────────────────────────────────────────────
  // primordial_mantle
  { id: 'amb_mantle_01', biome: 'primordial_mantle', text: 'Rock flows like taffy at these pressures. Time means nothing.' },
  { id: 'amb_mantle_02', biome: 'primordial_mantle', text: 'You touch material unchanged since Earth\'s formation.' },

  // iron_core_fringe
  { id: 'amb_ironcore_01', biome: 'iron_core_fringe', text: 'Magnetic fields twist your instruments into confusion.' },
  { id: 'amb_ironcore_02', biome: 'iron_core_fringe', triggerBlock: BlockType.MineralNode, text: 'Pure iron, crystallized under impossible pressure.' },

  // pressure_dome
  { id: 'amb_pressure_01', biome: 'pressure_dome', text: 'The walls groan. Everything down here is under siege.' },
  { id: 'amb_pressure_02', biome: 'pressure_dome', text: 'Your suit creaks in protest. This depth was not meant for visitors.' },

  // deep_biolume
  { id: 'amb_biolume_01', biome: 'deep_biolume', text: 'Pale blue light pulses from organisms that predate thought.' },
  { id: 'amb_biolume_02', biome: 'deep_biolume', text: 'Living light drifts through cracks in the stone.' },

  // tectonic_scar
  { id: 'amb_tectonic_01', biome: 'tectonic_scar', text: 'Two continents collided here. The wound never healed.' },
  { id: 'amb_tectonic_02', biome: 'tectonic_scar', triggerBlock: BlockType.ArtifactNode, text: 'A city\'s remains, folded into the fault line like origami.' },

  // ── Special Biomes ────────────────────────────────────────────────
  // temporal_rift
  { id: 'amb_temporal_01', biome: 'temporal_rift', text: 'Your shadow arrives a half-second late.' },
  { id: 'amb_temporal_02', biome: 'temporal_rift', text: 'The rock here shows three ages at once, layered impossibly.' },
  { id: 'amb_temporal_03', biome: 'temporal_rift', triggerBlock: BlockType.ArtifactNode, text: 'An object from a future that never happened.' },

  // alien_intrusion
  { id: 'amb_alien_01', biome: 'alien_intrusion', text: 'The mineral composition matches nothing in Earth\'s catalog.' },
  { id: 'amb_alien_02', biome: 'alien_intrusion', text: 'Geometric patterns repeat at scales that suggest intent.' },
  { id: 'amb_alien_03', biome: 'alien_intrusion', triggerBlock: BlockType.MineralNode, text: 'A metal that hums at a frequency your suit can\'t identify.' },

  // bioluminescent
  { id: 'amb_biolum_01', biome: 'bioluminescent', text: 'Green light blooms and fades like breathing.' },
  { id: 'amb_biolum_02', biome: 'bioluminescent', text: 'The fungi here have outlived every surface civilization.' },
];
