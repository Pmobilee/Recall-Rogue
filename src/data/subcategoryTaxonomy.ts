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
    { id: 'africa', label: 'Africa', description: 'Geography facts specifically about Africa' },
    { id: 'asia_oceania', label: 'Asia & Oceania', description: 'Asia, Australia, Pacific islands' },
    { id: 'europe', label: 'Europe', description: 'European geography facts' },
    { id: 'americas', label: 'Americas', description: 'North/South/Central America, Caribbean' },
    { id: 'landforms_water', label: 'Landforms & Water', description: 'Mountains, rivers, lakes, islands, deserts, oceans, caves' },
    { id: 'extreme_records', label: 'Records & Extremes', description: 'Highest, deepest, largest, smallest, hottest, driest' },
    { id: 'climate_biomes', label: 'Climate & Biomes', description: 'Weather patterns, climate zones, biomes' },
  ],
  geography_drill: [
    { id: 'capitals_countries', label: 'Capital Cities', description: 'Capital city of each country' },
    { id: 'countries_capitals', label: 'Countries by Capital', description: 'Identify the country from its capital' },
    { id: 'major_capitals', label: 'Major World Capitals', description: 'Most important capital cities' },
    { id: 'south_american_capitals', label: 'South American Capitals', description: 'Capital cities of South America' },
    { id: 'central_american_capitals', label: 'Central American Capitals', description: 'Capital cities of Central America' },
    { id: 'african_capitals', label: 'African Capitals', description: 'Capital cities of Africa' },
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
  social_sciences: [
    { id: 'psychology', label: 'Psychology', description: 'Cognitive, behavioral, developmental, and clinical psychology' },
    { id: 'microeconomics', label: 'Microeconomics', description: 'Supply and demand, market structures, firm theory, factor markets' },
    { id: 'macroeconomics', label: 'Macroeconomics', description: 'GDP, monetary policy, fiscal policy, international trade' },
    { id: 'sociology', label: 'Sociology', description: 'Social structures, institutions, culture, and group behavior' },
    { id: 'political_science', label: 'Political Science', description: 'Government systems, political theory, public policy' },
  ],
  language: [
    { id: 'chinese_hsk1', label: 'Chinese HSK 1', description: 'HSK Level 1 (A1) beginner Chinese vocabulary' },
    { id: 'chinese_hsk2', label: 'Chinese HSK 2', description: 'HSK Level 2 (A2) elementary Chinese vocabulary' },
    { id: 'chinese_hsk3', label: 'Chinese HSK 3', description: 'HSK Level 3 (B1) intermediate Chinese vocabulary' },
    { id: 'chinese_hsk4', label: 'Chinese HSK 4', description: 'HSK Level 4 (B2) upper-intermediate Chinese vocabulary' },
    { id: 'chinese_hsk5', label: 'Chinese HSK 5', description: 'HSK Level 5 (C1) advanced Chinese vocabulary' },
    { id: 'chinese_hsk6', label: 'Chinese HSK 6', description: 'HSK Level 6 (C2) proficient Chinese vocabulary' },
    { id: 'chinese_hsk7', label: 'Chinese HSK 7-9', description: 'HSK Level 7-9 (C2+) mastery Chinese vocabulary' },
    { id: 'japanese_n5', label: 'Japanese N5', description: 'JLPT N5 beginner Japanese vocabulary' },
    { id: 'japanese_n4', label: 'Japanese N4', description: 'JLPT N4 elementary Japanese vocabulary' },
    { id: 'japanese_n3', label: 'Japanese N3', description: 'JLPT N3 intermediate Japanese vocabulary' },
    { id: 'japanese_n2', label: 'Japanese N2', description: 'JLPT N2 upper-intermediate Japanese vocabulary' },
    { id: 'japanese_n1', label: 'Japanese N1', description: 'JLPT N1 advanced Japanese vocabulary' },
    { id: 'japanese_n5_kanji', label: 'Japanese N5 Kanji', description: 'JLPT N5 kanji meanings, readings, and recognition' },
    { id: 'japanese_n4_kanji', label: 'Japanese N4 Kanji', description: 'JLPT N4 kanji meanings, readings, and recognition' },
    { id: 'japanese_n3_kanji', label: 'Japanese N3 Kanji', description: 'JLPT N3 kanji meanings, readings, and recognition' },
    { id: 'japanese_n2_kanji', label: 'Japanese N2 Kanji', description: 'JLPT N2 kanji meanings, readings, and recognition' },
    { id: 'japanese_n1_kanji', label: 'Japanese N1 Kanji', description: 'JLPT N1 kanji meanings, readings, and recognition' },
    { id: 'japanese_hiragana', label: 'Hiragana', description: 'Hiragana character recognition and readings' },
    { id: 'japanese_katakana', label: 'Katakana', description: 'Katakana character recognition and readings' },
    { id: 'spanish_a1', label: 'Spanish A1', description: 'CEFR A1 beginner Spanish vocabulary' },
    { id: 'spanish_a2', label: 'Spanish A2', description: 'CEFR A2 elementary Spanish vocabulary' },
    { id: 'spanish_b1', label: 'Spanish B1', description: 'CEFR B1 intermediate Spanish vocabulary' },
    { id: 'spanish_b2', label: 'Spanish B2', description: 'CEFR B2 upper-intermediate Spanish vocabulary' },
    { id: 'spanish_c1', label: 'Spanish C1', description: 'CEFR C1 advanced Spanish vocabulary' },
    { id: 'french_a1', label: 'French A1', description: 'CEFR A1 beginner French vocabulary' },
    { id: 'french_a2', label: 'French A2', description: 'CEFR A2 elementary French vocabulary' },
    { id: 'french_b1', label: 'French B1', description: 'CEFR B1 intermediate French vocabulary' },
    { id: 'french_b2', label: 'French B2', description: 'CEFR B2 upper-intermediate French vocabulary' },
    { id: 'french_c1', label: 'French C1', description: 'CEFR C1 advanced French vocabulary' },
    { id: 'french_c2', label: 'French C2', description: 'CEFR C2 proficient French vocabulary' },
    { id: 'german_a1', label: 'German A1', description: 'CEFR A1 beginner German vocabulary' },
    { id: 'german_a2', label: 'German A2', description: 'CEFR A2 elementary German vocabulary' },
    { id: 'german_b1', label: 'German B1', description: 'CEFR B1 intermediate German vocabulary' },
    { id: 'german_b2', label: 'German B2', description: 'CEFR B2 upper-intermediate German vocabulary' },
    { id: 'german_c1', label: 'German C1', description: 'CEFR C1 advanced German vocabulary' },
    { id: 'german_c2', label: 'German C2', description: 'CEFR C2 proficient German vocabulary' },
    { id: 'dutch_a1', label: 'Dutch A1', description: 'CEFR A1 beginner Dutch vocabulary' },
    { id: 'dutch_a2', label: 'Dutch A2', description: 'CEFR A2 elementary Dutch vocabulary' },
    { id: 'dutch_b1', label: 'Dutch B1', description: 'CEFR B1 intermediate Dutch vocabulary' },
    { id: 'dutch_b2', label: 'Dutch B2', description: 'CEFR B2 upper-intermediate Dutch vocabulary' },
    { id: 'dutch_c1', label: 'Dutch C1', description: 'CEFR C1 advanced Dutch vocabulary' },
    { id: 'czech_a1', label: 'Czech A1', description: 'CEFR A1 beginner Czech vocabulary' },
    { id: 'czech_a2', label: 'Czech A2', description: 'CEFR A2 elementary Czech vocabulary' },
    { id: 'czech_b1', label: 'Czech B1', description: 'CEFR B1 intermediate Czech vocabulary' },
    { id: 'czech_b2', label: 'Czech B2', description: 'CEFR B2 upper-intermediate Czech vocabulary' },
    { id: 'czech_c1', label: 'Czech C1', description: 'CEFR C1 advanced Czech vocabulary' },
    { id: 'korean_beginner', label: 'Korean Beginner', description: 'TOPIK 초급 (beginner) Korean vocabulary (CEFR A1-A2)' },
    { id: 'korean_intermediate', label: 'Korean Intermediate', description: 'TOPIK 중급 (intermediate) Korean vocabulary (CEFR B1-B2)' },
    { id: 'korean_advanced', label: 'Korean Advanced', description: 'TOPIK 고급 (advanced) Korean vocabulary (CEFR C1+)' },
  ],
}

/** Look up the display label for a subcategory ID within a domain.
 *  Falls back to a cross-domain search, then title-cases the raw ID as a last resort. */
export function getSubcategoryLabel(domain: CanonicalFactDomain, subcategoryId: string): string {
  // 1. Try the specified domain first
  const defs = SUBCATEGORY_TAXONOMY[domain]
  if (defs) {
    const match = defs.find((d) => d.id === subcategoryId)
    if (match) return match.label
  }

  // 2. Cross-domain fallback — search all domains
  for (const entries of Object.values(SUBCATEGORY_TAXONOMY)) {
    const match = entries.find((d) => d.id === subcategoryId)
    if (match) return match.label
  }

  // 3. Last resort: title-case the raw ID
  return subcategoryId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
