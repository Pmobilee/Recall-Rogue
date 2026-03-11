import type { CanonicalFactDomain } from './card-types'

export interface SubcategoryDef {
  id: string
  label: string
  description: string
}

export const SUBCATEGORY_TAXONOMY: Partial<Record<CanonicalFactDomain, SubcategoryDef[]>> = {
  general_knowledge: [
    { id: 'records_firsts', label: 'Records & Firsts', description: 'World records, "first ever", superlatives, Guinness-type facts' },
    { id: 'inventions_tech', label: 'Inventions & Technology', description: 'Inventions, patents, tech milestones, computing, engineering feats' },
    { id: 'landmarks_wonders', label: 'Landmarks & Wonders', description: 'Famous buildings, natural/man-made wonders, monuments, temples' },
    { id: 'pop_culture', label: 'Pop Culture & Media', description: 'Movies, TV, music, sports, games, celebrities' },
    { id: 'words_language', label: 'Words & Language', description: 'Etymology, word origins, linguistic quirks, idioms' },
    { id: 'everyday_science', label: 'Everyday Science', description: 'Household science, common misconceptions, "did you know" sciency facts' },
    { id: 'oddities', label: 'Oddities & Curiosities', description: 'Bizarre, counterintuitive, or surprising trivia' },
  ],
  natural_sciences: [
    { id: 'chemistry_elements', label: 'Chemistry & Elements', description: 'Periodic table elements, chemical reactions, compounds' },
    { id: 'materials_engineering', label: 'Materials & Engineering', description: 'Alloys, ceramics, glass, textiles, construction materials' },
    { id: 'biology_organisms', label: 'Biology & Organisms', description: 'Taxonomy, microorganisms, cell biology, genetics (non-human)' },
    { id: 'physics_mechanics', label: 'Physics & Mechanics', description: 'Forces, energy, thermodynamics, optics, quantum, relativity' },
    { id: 'geology_earth', label: 'Geology & Earth', description: 'Rocks, minerals, plate tectonics, volcanoes, fossils' },
    { id: 'botany_plants', label: 'Plants & Botany', description: 'Plant species, photosynthesis, agriculture, forestry' },
    { id: 'ecology_environment', label: 'Ecology & Environment', description: 'Ecosystems, climate science, pollution, nature conservation' },
  ],
  space_astronomy: [
    { id: 'missions_spacecraft', label: 'Missions & Spacecraft', description: 'Named missions, launch vehicles, probes, space programs' },
    { id: 'planets_moons', label: 'Planets & Moons', description: 'Solar system bodies, planetary science, moons, dwarf planets' },
    { id: 'stars_galaxies', label: 'Stars & Galaxies', description: 'Stellar physics, nebulae, galaxies, star types' },
    { id: 'cosmology_universe', label: 'Cosmology & Universe', description: 'Big Bang, dark matter/energy, cosmic structures' },
    { id: 'satellites_tech', label: 'Satellites & Space Tech', description: 'Orbital mechanics, telescopes, ISS, space stations' },
    { id: 'exoplanets_astrobio', label: 'Exoplanets & Astrobiology', description: 'Habitable zones, SETI, extremophiles, exoplanet discoveries' },
  ],
  geography: [
    { id: 'capitals_countries', label: 'Capitals & Countries', description: 'Capital cities, country facts, flags, populations' },
    { id: 'africa', label: 'Africa', description: 'Geography facts specifically about Africa' },
    { id: 'asia_oceania', label: 'Asia & Oceania', description: 'Asia, Australia, Pacific islands' },
    { id: 'europe', label: 'Europe', description: 'European geography facts' },
    { id: 'americas', label: 'Americas', description: 'North/South/Central America, Caribbean' },
    { id: 'landforms_water', label: 'Landforms & Water', description: 'Mountains, rivers, lakes, islands, deserts, oceans, caves' },
    { id: 'extreme_records', label: 'Records & Extremes', description: 'Highest, deepest, largest, smallest, hottest, driest' },
    { id: 'climate_biomes', label: 'Climate & Biomes', description: 'Weather patterns, climate zones, biomes' },
  ],
  history: [
    { id: 'ancient_classical', label: 'Ancient & Classical', description: 'Pre-500 AD: Egypt, Greece, Rome, Persia, Mesopotamia' },
    { id: 'medieval', label: 'Medieval', description: '500-1500: Crusades, feudalism, Byzantine, Islamic golden age' },
    { id: 'early_modern', label: 'Early Modern', description: '1500-1800: Renaissance, exploration, colonialism, revolutions' },
    { id: 'modern_contemporary', label: 'Modern & Contemporary', description: '1800-present: industrialization, nationalism, Cold War' },
    { id: 'world_wars', label: 'World Wars', description: 'WWI and WWII specifically' },
    { id: 'battles_military', label: 'Battles & Military', description: 'Named battles, strategy, weapons, warfare tech (any era)' },
    { id: 'people_leaders', label: 'People & Leaders', description: 'Rulers, inventors, reformers, historical figures' },
    { id: 'social_cultural', label: 'Social & Cultural', description: "Women's history, civil rights, cultural movements, daily life" },
  ],
  mythology_folklore: [
    { id: 'greek_roman', label: 'Greek & Roman', description: 'Olympian gods, Titans, Greek/Roman myths, heroes' },
    { id: 'norse_celtic', label: 'Norse & Celtic', description: 'Asgard, runes, Arthurian legend, druids, faeries' },
    { id: 'eastern_myths', label: 'Eastern Mythology', description: 'Hindu, Buddhist, Chinese, Japanese, Islamic mythology' },
    { id: 'creatures_monsters', label: 'Creatures & Monsters', description: 'Dragons, chimeras, cryptids, supernatural beasts' },
    { id: 'creation_cosmology', label: 'Creation & Cosmology', description: 'Origin stories, flood myths, afterlife, cosmic order' },
    { id: 'folk_legends', label: 'Folk Tales & Legends', description: 'Regional folklore, fairy tales, urban legends, tricksters' },
    { id: 'gods_deities', label: 'Gods & Deities', description: 'Pantheons, divine figures, demigods (non-Greek/Norse/Eastern)' },
  ],
  animals_wildlife: [
    { id: 'mammals', label: 'Mammals', description: 'All mammal species, behavior, habitats' },
    { id: 'birds', label: 'Birds', description: 'All bird species, migration, nesting, flight' },
    { id: 'marine_life', label: 'Marine Life', description: 'Fish, whales, coral, deep sea, freshwater creatures' },
    { id: 'insects_arachnids', label: 'Insects & Arachnids', description: 'Bugs, spiders, butterflies, ants, bees' },
    { id: 'reptiles_amphibians', label: 'Reptiles & Amphibians', description: 'Snakes, lizards, turtles, frogs, salamanders' },
    { id: 'behavior_intelligence', label: 'Behavior & Intelligence', description: 'Communication, tool use, social structures, memory' },
    { id: 'conservation', label: 'Conservation', description: 'Endangered species, extinction, habitat loss, rewilding' },
    { id: 'adaptations', label: 'Adaptations & Records', description: 'Camouflage, venom, speed records, extreme survival' },
  ],
  human_body_health: [
    { id: 'anatomy_organs', label: 'Anatomy & Organs', description: 'Bones, muscles, organ systems, tissue' },
    { id: 'brain_neuro', label: 'Brain & Neuroscience', description: 'Brain regions, neurons, cognition, mental health' },
    { id: 'genetics_dna', label: 'Genetics & DNA', description: 'Genes, chromosomes, heredity, mutations, proteins' },
    { id: 'cardiovascular', label: 'Heart & Blood', description: 'Heart, arteries, veins, blood cells, circulation' },
    { id: 'digestion_metabolism', label: 'Digestion & Metabolism', description: 'Stomach, intestines, enzymes, nutrients, calories' },
    { id: 'senses_perception', label: 'Senses & Perception', description: 'Vision, hearing, taste, smell, touch, pain' },
    { id: 'immunity_disease', label: 'Immunity & Disease', description: 'Immune system, vaccines, viruses, bacteria, allergies' },
    { id: 'medical_science', label: 'Medical Science', description: 'Surgery, diagnostics, medical devices, drug discovery' },
  ],
  food_cuisine: [
    { id: 'european_cuisine', label: 'European Cuisine', description: 'French, Italian, Spanish, German, British, Scandinavian dishes' },
    { id: 'asian_cuisine', label: 'Asian Cuisine', description: 'Japanese, Chinese, Korean, Vietnamese, Thai, Indian dishes' },
    { id: 'world_cuisine', label: 'World Cuisine', description: 'African, Middle Eastern, Latin American, Caribbean dishes' },
    { id: 'baking_desserts', label: 'Baking & Desserts', description: 'Cakes, pastries, breads, cookies, confections' },
    { id: 'fermentation_beverages', label: 'Fermentation & Beverages', description: 'Beer, wine, coffee, tea, pickles, fermented foods' },
    { id: 'food_history', label: 'Food History & Origins', description: 'Origin stories, cultural significance, food trade routes' },
    { id: 'food_science', label: 'Food Science & Techniques', description: 'Cooking chemistry, preservation, Maillard reaction' },
    { id: 'ingredients_spices', label: 'Ingredients & Spices', description: 'Individual ingredients, spice origins, flavor profiles' },
  ],
  art_architecture: [
    { id: 'museums_institutions', label: 'Museums & Institutions', description: 'Named museums, galleries, cultural centers' },
    { id: 'historic_buildings', label: 'Historic Buildings', description: 'Castles, palaces, temples, cathedrals, fortresses' },
    { id: 'painting_visual', label: 'Painting & Visual Arts', description: 'Named paintings, artists, art movements, techniques' },
    { id: 'sculpture_decorative', label: 'Sculpture & Decorative Arts', description: 'Statues, pottery, mosaics, jewelry, crafts' },
    { id: 'modern_contemporary', label: 'Modern & Contemporary Art', description: '20th-21st century art, installations, digital art' },
    { id: 'architectural_styles', label: 'Architectural Styles', description: 'Gothic, Baroque, Art Deco, Brutalism, Modernism' },
    { id: 'engineering_design', label: 'Engineering & Design', description: 'Structural engineering, bridges, dams, infrastructure' },
  ],
}

/** Look up the display label for a subcategory ID within a domain. Returns the raw ID if not found. */
export function getSubcategoryLabel(domain: CanonicalFactDomain, subcategoryId: string): string {
  const defs = SUBCATEGORY_TAXONOMY[domain]
  if (!defs) return subcategoryId
  const match = defs.find((d) => d.id === subcategoryId)
  return match ? match.label : subcategoryId
}
