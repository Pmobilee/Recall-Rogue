/** All possible mechanical effect types a fossil companion can provide. */
export type CompanionEffectType =
  | 'mineral_rate'   // Chance to add +1 mineral when collecting a node
  | 'layer_oxygen'   // Restore N oxygen units on each layer descent
  | 'hazard_alert'   // Reveal hazard blocks within N tiles even through fog
  | 'max_oxygen'     // Increase max oxygen at dive start
  | 'magnet_range'   // Extend mineral_magnet radius by N tiles
  | 'reveal_exit'    // Reveal exit ladder location at dive start
  | 'instant_break'  // N% chance to instantly destroy any block in one hit
  | 'extra_slot'     // Add N extra inventory slots at dive start
  | 'hazard_resist'  // Reduce hazard O2 costs by N (stacks with tough_skin relic)
  | 'scout_drone'    // Reveal a random cluster of tiles at dive start

/** A typed mechanical effect carried by a revived fossil companion. */
export interface CompanionEffect {
  type: CompanionEffectType
  /** Numeric magnitude — e.g. 0.05 = 5%, 3 = +3 O2, 2 = +2 tiles, etc. */
  value: number
}

/** A single fossil species that can be collected and revived as a companion. */
export interface FossilSpecies {
  id: string
  name: string
  icon: string // emoji
  era: string
  description: string
  fragmentsNeeded: number // 3-8
  requiredFacts: number // facts learned to unlock revival
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary'
  /** Human-readable bonus description */
  companionBonus?: string
  /** Typed mechanical effect applied when this companion is active */
  companionEffect: CompanionEffect
  /** True for fossilized plant/crop species. Crops cannot be set as dive companions. */
  isCrop?: boolean
  /** Botanical/agricultural fact category tags for knowledge gating (used in Phase 16.2). */
  factCategories?: string[]
  /** Array of exactly 10 fact IDs the player must learn to revive this species. */
  requiredSpeciesFacts?: string[]
}

export const FOSSIL_SPECIES: FossilSpecies[] = [
  {
    id: 'trilobite',
    name: 'Trilobite',
    icon: '🦐',
    era: 'Paleozoic',
    description: 'An ancient arthropod that ruled the seas for 300 million years',
    fragmentsNeeded: 3,
    requiredFacts: 5,
    rarity: 'common',
    companionBonus: '+5% mineral find rate',
    companionEffect: { type: 'mineral_rate', value: 0.05 },
    requiredSpeciesFacts: ['fossil_trilobite_01', 'fossil_trilobite_02', 'fossil_trilobite_03', 'fossil_trilobite_04', 'fossil_trilobite_05', 'fossil_trilobite_06', 'fossil_trilobite_07', 'fossil_trilobite_08', 'fossil_trilobite_09', 'fossil_trilobite_10'],
  },
  {
    id: 'ammonite',
    name: 'Ammonite',
    icon: '🐚',
    era: 'Mesozoic',
    description: 'A spiral-shelled cephalopod, cousin to the nautilus',
    fragmentsNeeded: 3,
    requiredFacts: 8,
    rarity: 'common',
    companionBonus: '+3 O2 per layer',
    companionEffect: { type: 'layer_oxygen', value: 3 },
    requiredSpeciesFacts: ['fossil_ammonite_01', 'fossil_ammonite_02', 'fossil_ammonite_03', 'fossil_ammonite_04', 'fossil_ammonite_05', 'fossil_ammonite_06', 'fossil_ammonite_07', 'fossil_ammonite_08', 'fossil_ammonite_09', 'fossil_ammonite_10'],
  },
  {
    id: 'raptor',
    name: 'Velociraptor',
    icon: '🦖',
    era: 'Cretaceous',
    description: 'A feathered predator, smaller but smarter than the movies suggest',
    fragmentsNeeded: 5,
    requiredFacts: 15,
    rarity: 'uncommon',
    companionBonus: 'Alerts nearby hazards',
    companionEffect: { type: 'hazard_alert', value: 2 },
    requiredSpeciesFacts: ['fossil_raptor_01', 'fossil_raptor_02', 'fossil_raptor_03', 'fossil_raptor_04', 'fossil_raptor_05', 'fossil_raptor_06', 'fossil_raptor_07', 'fossil_raptor_08', 'fossil_raptor_09', 'fossil_raptor_10'],
  },
  {
    id: 'mammoth',
    name: 'Woolly Mammoth',
    icon: '🦣',
    era: 'Pleistocene',
    description: 'A gentle giant that roamed the ice age tundra',
    fragmentsNeeded: 5,
    requiredFacts: 15,
    rarity: 'uncommon',
    companionBonus: '+10 max O2',
    companionEffect: { type: 'max_oxygen', value: 10 },
    requiredSpeciesFacts: ['fossil_mammoth_01', 'fossil_mammoth_02', 'fossil_mammoth_03', 'fossil_mammoth_04', 'fossil_mammoth_05', 'fossil_mammoth_06', 'fossil_mammoth_07', 'fossil_mammoth_08', 'fossil_mammoth_09', 'fossil_mammoth_10'],
  },
  {
    id: 'megalodon',
    name: 'Megalodon',
    icon: '🦈',
    era: 'Cenozoic',
    description: 'A prehistoric shark that could swallow a car whole',
    fragmentsNeeded: 6,
    requiredFacts: 25,
    rarity: 'rare',
    companionBonus: '2x mineral magnet range',
    companionEffect: { type: 'magnet_range', value: 2 },
    requiredSpeciesFacts: ['fossil_megalodon_01', 'fossil_megalodon_02', 'fossil_megalodon_03', 'fossil_megalodon_04', 'fossil_megalodon_05', 'fossil_megalodon_06', 'fossil_megalodon_07', 'fossil_megalodon_08', 'fossil_megalodon_09', 'fossil_megalodon_10'],
  },
  {
    id: 'pteranodon',
    name: 'Pteranodon',
    icon: '🦅',
    era: 'Cretaceous',
    description: 'A flying reptile with a 7-meter wingspan',
    fragmentsNeeded: 6,
    requiredFacts: 25,
    rarity: 'rare',
    companionBonus: 'Reveals exit location',
    companionEffect: { type: 'reveal_exit', value: 1 },
    requiredSpeciesFacts: ['fossil_pteranodon_01', 'fossil_pteranodon_02', 'fossil_pteranodon_03', 'fossil_pteranodon_04', 'fossil_pteranodon_05', 'fossil_pteranodon_06', 'fossil_pteranodon_07', 'fossil_pteranodon_08', 'fossil_pteranodon_09', 'fossil_pteranodon_10'],
  },
  {
    id: 'trex',
    name: 'Tyrannosaurus Rex',
    icon: '🦕',
    era: 'Cretaceous',
    description: 'The king of the dinosaurs, with a bite force of 12,800 pounds',
    fragmentsNeeded: 8,
    requiredFacts: 40,
    rarity: 'legendary',
    companionBonus: 'Breaks blocks in 1 hit (10% chance)',
    companionEffect: { type: 'instant_break', value: 0.10 },
    requiredSpeciesFacts: ['fossil_trex_01', 'fossil_trex_02', 'fossil_trex_03', 'fossil_trex_04', 'fossil_trex_05', 'fossil_trex_06', 'fossil_trex_07', 'fossil_trex_08', 'fossil_trex_09', 'fossil_trex_10'],
  },
  {
    id: 'dodo',
    name: 'Dodo',
    icon: '🐦',
    era: 'Holocene',
    description: 'A flightless bird driven to extinction by humans in 1681',
    fragmentsNeeded: 4,
    requiredFacts: 10,
    rarity: 'common',
    companionBonus: '+1 inventory slot',
    companionEffect: { type: 'extra_slot', value: 1 },
    requiredSpeciesFacts: ['fossil_dodo_01', 'fossil_dodo_02', 'fossil_dodo_03', 'fossil_dodo_04', 'fossil_dodo_05', 'fossil_dodo_06', 'fossil_dodo_07', 'fossil_dodo_08', 'fossil_dodo_09', 'fossil_dodo_10'],
  },
  {
    id: 'sabertooth',
    name: 'Saber-toothed Cat',
    icon: '🐱',
    era: 'Pleistocene',
    description: 'A fearsome feline with 7-inch canine teeth',
    fragmentsNeeded: 5,
    requiredFacts: 20,
    rarity: 'uncommon',
    companionBonus: '-3 O2 per hazard',
    companionEffect: { type: 'hazard_resist', value: 3 },
    requiredSpeciesFacts: ['fossil_sabertooth_01', 'fossil_sabertooth_02', 'fossil_sabertooth_03', 'fossil_sabertooth_04', 'fossil_sabertooth_05', 'fossil_sabertooth_06', 'fossil_sabertooth_07', 'fossil_sabertooth_08', 'fossil_sabertooth_09', 'fossil_sabertooth_10'],
  },
  {
    id: 'archaeopteryx',
    name: 'Archaeopteryx',
    icon: '🪶',
    era: 'Jurassic',
    description: 'The first known bird, bridging dinosaurs and modern avians',
    fragmentsNeeded: 7,
    requiredFacts: 30,
    rarity: 'rare',
    companionBonus: 'Scout drone on each dive',
    companionEffect: { type: 'scout_drone', value: 1 },
    requiredSpeciesFacts: ['fossil_archaeopteryx_01', 'fossil_archaeopteryx_02', 'fossil_archaeopteryx_03', 'fossil_archaeopteryx_04', 'fossil_archaeopteryx_05', 'fossil_archaeopteryx_06', 'fossil_archaeopteryx_07', 'fossil_archaeopteryx_08', 'fossil_archaeopteryx_09', 'fossil_archaeopteryx_10'],
  },
  // ─── Crop Fossils (Phase 16.1) ────────────────────────────────
  {
    id: 'ancient_wheat',
    name: 'Ancient Wheat',
    icon: '🌾',
    era: 'Neolithic',
    description: 'Fossilized einkorn wheat, ancestor of every bread ever baked',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'History'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_ancient_wheat_01', 'fossil_ancient_wheat_02', 'fossil_ancient_wheat_03', 'fossil_ancient_wheat_04', 'fossil_ancient_wheat_05', 'fossil_ancient_wheat_06', 'fossil_ancient_wheat_07', 'fossil_ancient_wheat_08', 'fossil_ancient_wheat_09', 'fossil_ancient_wheat_10'],
  },
  {
    id: 'lotus_fossil',
    name: 'Sacred Lotus',
    icon: '🪷',
    era: 'Cretaceous',
    description: 'An 85-million-year-old lotus seed. Lotus seeds can stay viable for over 1,300 years.',
    fragmentsNeeded: 3,
    requiredFacts: 10,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_lotus_fossil_01', 'fossil_lotus_fossil_02', 'fossil_lotus_fossil_03', 'fossil_lotus_fossil_04', 'fossil_lotus_fossil_05', 'fossil_lotus_fossil_06', 'fossil_lotus_fossil_07', 'fossil_lotus_fossil_08', 'fossil_lotus_fossil_09', 'fossil_lotus_fossil_10'],
  },
  {
    id: 'cave_mushroom',
    name: 'Primordial Mushroom',
    icon: '🍄',
    era: 'Carboniferous',
    description: 'A 350-million-year-old fungal spore. Fungi are more closely related to animals than plants.',
    fragmentsNeeded: 4,
    requiredFacts: 15,
    rarity: 'common',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_cave_mushroom_01', 'fossil_cave_mushroom_02', 'fossil_cave_mushroom_03', 'fossil_cave_mushroom_04', 'fossil_cave_mushroom_05', 'fossil_cave_mushroom_06', 'fossil_cave_mushroom_07', 'fossil_cave_mushroom_08', 'fossil_cave_mushroom_09', 'fossil_cave_mushroom_10'],
  },
  {
    id: 'ancient_rice',
    name: 'Ancient Rice',
    icon: '🌾',
    era: 'Holocene',
    description: 'Rice domesticated ~9,000 years ago in the Yangtze River Delta. Half the world still eats it daily.',
    fragmentsNeeded: 4,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Geography'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_ancient_rice_01', 'fossil_ancient_rice_02', 'fossil_ancient_rice_03', 'fossil_ancient_rice_04', 'fossil_ancient_rice_05', 'fossil_ancient_rice_06', 'fossil_ancient_rice_07', 'fossil_ancient_rice_08', 'fossil_ancient_rice_09', 'fossil_ancient_rice_10'],
  },
  {
    id: 'giant_fern',
    name: 'Giant Tree Fern',
    icon: '🌿',
    era: 'Carboniferous',
    description: 'Coal itself is fossilized Carboniferous fern forest. Every coal seam is a buried ancient jungle.',
    fragmentsNeeded: 5,
    requiredFacts: 20,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_giant_fern_01', 'fossil_giant_fern_02', 'fossil_giant_fern_03', 'fossil_giant_fern_04', 'fossil_giant_fern_05', 'fossil_giant_fern_06', 'fossil_giant_fern_07', 'fossil_giant_fern_08', 'fossil_giant_fern_09', 'fossil_giant_fern_10'],
  },
  {
    id: 'amber_orchid',
    name: 'Amber Orchid',
    icon: '🌸',
    era: 'Jurassic',
    description: 'Preserved in amber for 100 million years. Orchids are the most species-diverse plant family on Earth.',
    fragmentsNeeded: 5,
    requiredFacts: 25,
    rarity: 'uncommon',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_amber_orchid_01', 'fossil_amber_orchid_02', 'fossil_amber_orchid_03', 'fossil_amber_orchid_04', 'fossil_amber_orchid_05', 'fossil_amber_orchid_06', 'fossil_amber_orchid_07', 'fossil_amber_orchid_08', 'fossil_amber_orchid_09', 'fossil_amber_orchid_10'],
  },
  {
    id: 'ancient_corn',
    name: 'Ancient Maize',
    icon: '🌽',
    era: 'Holocene',
    description: "Teosinte grass selectively bred into maize over 9,000 years — one of humanity's greatest agricultural achievements.",
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_ancient_corn_01', 'fossil_ancient_corn_02', 'fossil_ancient_corn_03', 'fossil_ancient_corn_04', 'fossil_ancient_corn_05', 'fossil_ancient_corn_06', 'fossil_ancient_corn_07', 'fossil_ancient_corn_08', 'fossil_ancient_corn_09', 'fossil_ancient_corn_10'],
  },
  {
    id: 'petrified_vine',
    name: 'Petrified Grapevine',
    icon: '🍇',
    era: 'Miocene',
    description: 'A 10-million-year-old grape fossil. Wine fermentation predates writing by thousands of years.',
    fragmentsNeeded: 6,
    requiredFacts: 35,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'History', 'Culture'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_petrified_vine_01', 'fossil_petrified_vine_02', 'fossil_petrified_vine_03', 'fossil_petrified_vine_04', 'fossil_petrified_vine_05', 'fossil_petrified_vine_06', 'fossil_petrified_vine_07', 'fossil_petrified_vine_08', 'fossil_petrified_vine_09', 'fossil_petrified_vine_10'],
  },
  {
    id: 'star_moss',
    name: 'Stellar Spore Moss',
    icon: '🌱',
    era: 'Silurian',
    description: 'Among the first land plants ever. This 430-million-year-old moss helped turn bare rock into soil.',
    fragmentsNeeded: 7,
    requiredFacts: 40,
    rarity: 'rare',
    isCrop: true,
    factCategories: ['Life Sciences', 'Natural Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_star_moss_01', 'fossil_star_moss_02', 'fossil_star_moss_03', 'fossil_star_moss_04', 'fossil_star_moss_05', 'fossil_star_moss_06', 'fossil_star_moss_07', 'fossil_star_moss_08', 'fossil_star_moss_09', 'fossil_star_moss_10'],
  },
  {
    id: 'world_tree_seed',
    name: 'World Tree Seedling',
    icon: '🌳',
    era: 'Precambrian',
    description: 'A 600-million-year-old seed from before complex multicellular life. Origin of all terrestrial plant lineages.',
    fragmentsNeeded: 8,
    requiredFacts: 60,
    rarity: 'legendary',
    isCrop: true,
    factCategories: ['Natural Sciences', 'Life Sciences'],
    companionEffect: { type: 'mineral_rate', value: 0 },
    requiredSpeciesFacts: ['fossil_world_tree_seed_01', 'fossil_world_tree_seed_02', 'fossil_world_tree_seed_03', 'fossil_world_tree_seed_04', 'fossil_world_tree_seed_05', 'fossil_world_tree_seed_06', 'fossil_world_tree_seed_07', 'fossil_world_tree_seed_08', 'fossil_world_tree_seed_09', 'fossil_world_tree_seed_10'],
  },
]

/**
 * Returns the fossil species with the given ID, or undefined if not found.
 */
export function getSpeciesById(id: string): FossilSpecies | undefined {
  return FOSSIL_SPECIES.find(s => s.id === id)
}

/**
 * Returns the CompanionEffect for the player's active companion, or null
 * if no companion is set or the species is unknown.
 * Handles backward-compat where activeCompanion may be undefined on old saves.
 */
export function getActiveCompanionEffect(playerSave: {
  activeCompanion?: string | null
  fossils?: Record<string, { revived: boolean }>
}): CompanionEffect | null {
  const companionId = playerSave.activeCompanion ?? null
  if (!companionId) return null

  // Verify the companion is actually revived (not just set on an old save)
  const fossilState = playerSave.fossils?.[companionId]
  if (!fossilState?.revived) return null

  const species = getSpeciesById(companionId)
  return species?.companionEffect ?? null
}

/**
 * Pick a random fossil species weighted by rarity. Uses the provided seeded RNG.
 * Weights: common=50, uncommon=30, rare=15, legendary=5.
 */
export function pickFossilDrop(rng: () => number): FossilSpecies {
  const weights: Record<FossilSpecies['rarity'], number> = {
    common: 50,
    uncommon: 30,
    rare: 15,
    legendary: 5,
  }
  const total = FOSSIL_SPECIES.reduce((sum, s) => sum + weights[s.rarity], 0)
  let roll = rng() * total
  for (const species of FOSSIL_SPECIES) {
    roll -= weights[species.rarity]
    if (roll <= 0) return species
  }
  return FOSSIL_SPECIES[0]
}
