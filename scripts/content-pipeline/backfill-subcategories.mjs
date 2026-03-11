/**
 * backfill-subcategories.mjs
 *
 * Fills missing or invalid categoryL2 values with taxonomy IDs for canonical fact domains.
 * The script is deterministic and uses:
 * - legacy category alias mapping
 * - domain-specific keyword scoring over statement/question/explanation/tags
 * - safe per-domain fallback IDs
 *
 * It can process:
 * - data/generated/*.jsonl
 * - src/data/seed/*.json
 *
 * Usage:
 *   node scripts/content-pipeline/backfill-subcategories.mjs
 *   node scripts/content-pipeline/backfill-subcategories.mjs --write
 *   node scripts/content-pipeline/backfill-subcategories.mjs --write --force
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..', '..')

const DOMAIN_LABELS = {
  general_knowledge: 'General Knowledge',
  natural_sciences: 'Natural Sciences',
  space_astronomy: 'Space & Astronomy',
  geography: 'Geography',
  history: 'History',
  mythology_folklore: 'Mythology & Folklore',
  animals_wildlife: 'Animals & Wildlife',
  human_body_health: 'Human Body & Health',
  food_cuisine: 'Food & World Cuisine',
  art_architecture: 'Art & Architecture',
}

const TAXONOMY = {
  general_knowledge: [
    'records_firsts',
    'inventions_tech',
    'landmarks_wonders',
    'pop_culture',
    'words_language',
    'everyday_science',
    'oddities',
  ],
  natural_sciences: [
    'chemistry_elements',
    'materials_engineering',
    'biology_organisms',
    'physics_mechanics',
    'geology_earth',
    'botany_plants',
    'ecology_environment',
  ],
  space_astronomy: [
    'missions_spacecraft',
    'planets_moons',
    'stars_galaxies',
    'cosmology_universe',
    'satellites_tech',
    'exoplanets_astrobio',
  ],
  geography: [
    'capitals_countries',
    'africa',
    'asia_oceania',
    'europe',
    'americas',
    'landforms_water',
    'extreme_records',
    'climate_biomes',
  ],
  history: [
    'ancient_classical',
    'medieval',
    'early_modern',
    'modern_contemporary',
    'world_wars',
    'battles_military',
    'people_leaders',
    'social_cultural',
  ],
  mythology_folklore: [
    'greek_roman',
    'norse_celtic',
    'eastern_myths',
    'creatures_monsters',
    'creation_cosmology',
    'folk_legends',
    'gods_deities',
  ],
  animals_wildlife: [
    'mammals',
    'birds',
    'marine_life',
    'insects_arachnids',
    'reptiles_amphibians',
    'behavior_intelligence',
    'conservation',
    'adaptations',
  ],
  human_body_health: [
    'anatomy_organs',
    'brain_neuro',
    'genetics_dna',
    'cardiovascular',
    'digestion_metabolism',
    'senses_perception',
    'immunity_disease',
    'medical_science',
  ],
  food_cuisine: [
    'european_cuisine',
    'asian_cuisine',
    'world_cuisine',
    'baking_desserts',
    'fermentation_beverages',
    'food_history',
    'food_science',
    'ingredients_spices',
  ],
  art_architecture: [
    'museums_institutions',
    'historic_buildings',
    'painting_visual',
    'sculpture_decorative',
    'modern_contemporary',
    'architectural_styles',
    'engineering_design',
  ],
}

const DEFAULT_SUBCATEGORY = {
  general_knowledge: 'oddities',
  natural_sciences: 'biology_organisms',
  space_astronomy: 'missions_spacecraft',
  geography: 'capitals_countries',
  history: 'modern_contemporary',
  mythology_folklore: 'folk_legends',
  animals_wildlife: 'conservation',
  human_body_health: 'anatomy_organs',
  food_cuisine: 'world_cuisine',
  art_architecture: 'historic_buildings',
}

const LEGACY_SUBCATEGORY_ALIASES = {
  general_knowledge: {
    computing: 'inventions_tech',
    engineering: 'inventions_tech',
    'space tech': 'inventions_tech',
    internet: 'inventions_tech',
    inventions: 'inventions_tech',
    robotics: 'inventions_tech',
    ai: 'inventions_tech',
    materials: 'inventions_tech',
    transportation: 'inventions_tech',
    energy: 'inventions_tech',
    literature: 'pop_culture',
    fashion: 'pop_culture',
    music: 'pop_culture',
    film: 'pop_culture',
    sports: 'pop_culture',
    art: 'pop_culture',
    food: 'pop_culture',
    mythology: 'oddities',
    traditions: 'oddities',
    records: 'records_firsts',
    landmarks: 'landmarks_wonders',
    language: 'words_language',
  },
  natural_sciences: {
    chemistry: 'chemistry_elements',
    biology: 'biology_organisms',
    'marine biology': 'biology_organisms',
    physics: 'physics_mechanics',
    geology: 'geology_earth',
    ecology: 'ecology_environment',
    botany: 'botany_plants',
    astronomy: 'physics_mechanics',
    mathematics: 'physics_mechanics',
  },
  space_astronomy: {
    astronomy: 'stars_galaxies',
    planets: 'planets_moons',
    missions: 'missions_spacecraft',
    satellites: 'satellites_tech',
    cosmology: 'cosmology_universe',
    exoplanets: 'exoplanets_astrobio',
  },
  geography: {
    capitals: 'capitals_countries',
    countries: 'capitals_countries',
    cities: 'capitals_countries',
    borders: 'capitals_countries',
    flags: 'capitals_countries',
    rivers: 'landforms_water',
    mountains: 'landforms_water',
    deserts: 'landforms_water',
    islands: 'landforms_water',
    oceans: 'landforms_water',
    landmarks: 'landforms_water',
    climate: 'climate_biomes',
    records: 'extreme_records',
  },
  history: {
    'ancient history': 'ancient_classical',
    'medieval history': 'medieval',
    'modern history': 'modern_contemporary',
    'early modern': 'early_modern',
    'world wars': 'world_wars',
    battles: 'battles_military',
    military: 'battles_military',
    leaders: 'people_leaders',
    people: 'people_leaders',
    social: 'social_cultural',
    cultural: 'social_cultural',
  },
  mythology_folklore: {
    greek: 'greek_roman',
    roman: 'greek_roman',
    norse: 'norse_celtic',
    celtic: 'norse_celtic',
    eastern: 'eastern_myths',
    creatures: 'creatures_monsters',
    monsters: 'creatures_monsters',
    creation: 'creation_cosmology',
    cosmology: 'creation_cosmology',
    folklore: 'folk_legends',
    legends: 'folk_legends',
    deities: 'gods_deities',
    gods: 'gods_deities',
  },
  animals_wildlife: {
    mammal: 'mammals',
    mammals: 'mammals',
    birds: 'birds',
    fish: 'marine_life',
    marine: 'marine_life',
    insects: 'insects_arachnids',
    arachnids: 'insects_arachnids',
    reptiles: 'reptiles_amphibians',
    amphibians: 'reptiles_amphibians',
    behavior: 'behavior_intelligence',
    intelligence: 'behavior_intelligence',
    conservation: 'conservation',
    adaptation: 'adaptations',
    adaptations: 'adaptations',
  },
  human_body_health: {
    anatomy: 'anatomy_organs',
    organs: 'anatomy_organs',
    brain: 'brain_neuro',
    neuroscience: 'brain_neuro',
    genetics: 'genetics_dna',
    dna: 'genetics_dna',
    cardiovascular: 'cardiovascular',
    blood: 'cardiovascular',
    digestion: 'digestion_metabolism',
    metabolism: 'digestion_metabolism',
    senses: 'senses_perception',
    perception: 'senses_perception',
    immunity: 'immunity_disease',
    disease: 'immunity_disease',
    medical: 'medical_science',
  },
  food_cuisine: {
    baking: 'baking_desserts',
    desserts: 'baking_desserts',
    fermentation: 'fermentation_beverages',
    beverages: 'fermentation_beverages',
    spices: 'ingredients_spices',
    ingredients: 'ingredients_spices',
    history: 'food_history',
    origins: 'food_history',
    science: 'food_science',
    techniques: 'food_science',
  },
  art_architecture: {
    museums: 'museums_institutions',
    institutions: 'museums_institutions',
    architecture: 'historic_buildings',
    buildings: 'historic_buildings',
    painting: 'painting_visual',
    sculpture: 'sculpture_decorative',
    modern: 'modern_contemporary',
    contemporary: 'modern_contemporary',
    styles: 'architectural_styles',
    engineering: 'engineering_design',
    design: 'engineering_design',
  },
}

const SUBCATEGORY_KEYWORDS = {
  general_knowledge: {
    records_firsts: ['record', 'first', 'oldest', 'largest', 'smallest', 'longest', 'highest', 'deepest', 'guinness', 'superlative'],
    inventions_tech: ['invention', 'invented', 'patent', 'technology', 'computer', 'internet', 'ai', 'robot', 'engineering', 'device', 'software', 'hardware'],
    landmarks_wonders: ['landmark', 'wonder', 'monument', 'temple', 'cathedral', 'church', 'mosque', 'palace', 'castle', 'pyramid', 'tower', 'statue', 'architecture', 'unesco'],
    pop_culture: ['movie', 'film', 'cinema', 'tv', 'music', 'song', 'celebrity', 'sports', 'olympics', 'game', 'fashion', 'oscar', 'grammy', 'actor', 'actress'],
    words_language: ['word', 'language', 'etymology', 'phrase', 'idiom', 'alphabet', 'linguistic', 'pronunciation', 'dictionary', 'acronym', 'slang', 'grammar'],
    everyday_science: ['science', 'physics', 'chemistry', 'biology', 'astronomy', 'brain', 'human body', 'experiment', 'weather', 'animal', 'plant'],
    oddities: ['bizarre', 'weird', 'odd', 'unusual', 'surprising', 'strange', 'misconception', 'hoax', 'quirky', 'counterintuitive'],
  },
  natural_sciences: {
    chemistry_elements: ['chemistry', 'chemical', 'element', 'periodic', 'atom', 'molecule', 'reaction', 'compound', 'acid', 'base', 'isotope', 'ion'],
    materials_engineering: ['material', 'alloy', 'steel', 'metal', 'ceramic', 'polymer', 'plastic', 'glass', 'concrete', 'textile', 'metallurgy', 'composite'],
    biology_organisms: ['biology', 'organism', 'species', 'cell', 'bacteria', 'fungi', 'microbe', 'taxonomy', 'evolution', 'marine biology'],
    physics_mechanics: ['physics', 'force', 'energy', 'motion', 'gravity', 'quantum', 'relativity', 'thermodynamics', 'optics', 'electricity', 'magnetism', 'acoustics'],
    geology_earth: ['geology', 'rock', 'mineral', 'fossil', 'tectonic', 'volcano', 'magma', 'earthquake', 'sedimentary', 'petroleum', 'earth science'],
    botany_plants: ['plant', 'tree', 'flower', 'seed', 'photosynthesis', 'botany', 'agriculture', 'crop', 'forest', 'bamboo'],
    ecology_environment: ['ecology', 'ecosystem', 'climate', 'environment', 'pollution', 'biodiversity', 'habitat', 'sustainability', 'conservation'],
  },
  space_astronomy: {
    missions_spacecraft: ['mission', 'spacecraft', 'probe', 'launch', 'rocket', 'apollo', 'soyuz', 'vanguard', 'saturn', 'test flight', 'space program'],
    planets_moons: ['planet', 'moon', 'mars', 'venus', 'jupiter', 'saturn', 'mercury', 'uranus', 'neptune', 'pluto', 'europa', 'titan', 'enceladus'],
    stars_galaxies: ['star', 'stellar', 'galaxy', 'nebula', 'supernova', 'pulsar', 'neutron star', 'milky way', 'constellation'],
    cosmology_universe: ['cosmology', 'universe', 'big bang', 'dark matter', 'dark energy', 'cosmic', 'inflation', 'multiverse', 'spacetime'],
    satellites_tech: ['satellite', 'orbit', 'orbital', 'iss', 'space station', 'hubble', 'telescope', 'geostationary', 'communications'],
    exoplanets_astrobio: ['exoplanet', 'astrobiology', 'habitability', 'seti', 'biosignature', 'extremophile', 'alien life', 'trappist', 'kepler'],
  },
  geography: {
    capitals_countries: ['capital', 'country', 'nation', 'flag', 'city', 'population', 'sovereign', 'microstate', 'border'],
    africa: ['africa', 'african', 'sahara', 'nile', 'sahel', 'ethiopia', 'kenya', 'nigeria', 'congo', 'ghana', 'morocco', 'algeria'],
    asia_oceania: ['asia', 'oceania', 'pacific', 'australia', 'new zealand', 'china', 'india', 'japan', 'korea', 'indonesia', 'philippines', 'malaysia'],
    europe: ['europe', 'european', 'france', 'germany', 'italy', 'spain', 'uk', 'britain', 'poland', 'greece', 'sweden', 'norway'],
    americas: ['america', 'americas', 'north america', 'south america', 'latin america', 'caribbean', 'usa', 'canada', 'mexico', 'brazil', 'argentina', 'chile'],
    landforms_water: ['river', 'lake', 'ocean', 'sea', 'mountain', 'desert', 'island', 'valley', 'canyon', 'glacier', 'waterfall', 'strait', 'bay'],
    extreme_records: ['highest', 'lowest', 'deepest', 'longest', 'largest', 'smallest', 'hottest', 'coldest', 'driest', 'wettest', 'extreme', 'record'],
    climate_biomes: ['climate', 'weather', 'rainfall', 'temperature', 'biome', 'monsoon', 'tundra', 'rainforest', 'desertification', 'arid'],
  },
  history: {
    ancient_classical: ['ancient', 'bce', 'classical', 'rome', 'roman', 'greece', 'greek', 'egypt', 'mesopotamia', 'persia', 'carthage'],
    medieval: ['medieval', 'middle ages', 'feudal', 'crusade', 'byzantine', 'viking', 'knight', 'manor'],
    early_modern: ['early modern', 'renaissance', 'reformation', 'enlightenment', 'colonial', 'age of exploration', '17th century', '18th century', 'napoleonic'],
    modern_contemporary: ['modern', 'industrial', '19th century', '20th century', '21st century', 'cold war', 'contemporary'],
    world_wars: ['world war i', 'world war ii', 'wwi', 'wwii', 'nazi', 'allied', 'd-day', 'trench', 'holocaust'],
    battles_military: ['battle', 'siege', 'war', 'campaign', 'military', 'army', 'navy', 'artillery', 'front'],
    people_leaders: ['king', 'queen', 'emperor', 'president', 'leader', 'ruler', 'biography', 'dynasty'],
    social_cultural: ['civil rights', 'women', 'labor', 'social', 'culture', 'daily life', 'reform', 'rights movement'],
  },
  mythology_folklore: {
    greek_roman: ['greek mythology', 'roman mythology', 'olympian', 'zeus', 'hera', 'apollo', 'athena', 'hades', 'dionysus', 'eros', 'cupid'],
    norse_celtic: ['norse', 'odin', 'thor', 'loki', 'valhalla', 'ragnarok', 'celtic', 'arthurian', 'druid', 'faerie'],
    eastern_myths: ['hindu', 'buddhist', 'chinese mythology', 'japanese mythology', 'shinto', 'taoist', 'islamic mythology', 'mazu'],
    creatures_monsters: ['monster', 'creature', 'dragon', 'cryptid', 'beast', 'chimera', 'demon', 'serpent', 'yokai', 'giant'],
    creation_cosmology: ['creation myth', 'origin story', 'flood myth', 'underworld', 'afterlife', 'cosmology', 'cosmic', 'world tree', 'apocalypse'],
    folk_legends: ['folklore', 'legend', 'fairy tale', 'urban legend', 'trickster', 'folk tale', 'oral tradition'],
    gods_deities: ['deity', 'god', 'goddess', 'pantheon', 'demigod', 'divine'],
  },
  animals_wildlife: {
    mammals: ['mammal', 'mammals', 'bat', 'cat', 'dog', 'whale', 'primate', 'rodent', 'feline', 'canine'],
    birds: ['bird', 'birds', 'avian', 'eagle', 'owl', 'penguin', 'raptor', 'sparrow', 'parrot'],
    marine_life: ['fish', 'marine', 'ocean', 'sea', 'shark', 'dolphin', 'seal', 'octopus', 'coral', 'jellyfish', 'freshwater'],
    insects_arachnids: ['insect', 'insects', 'arachnid', 'arachnids', 'spider', 'butterfly', 'bee', 'ant', 'beetle', 'moth', 'scorpion'],
    reptiles_amphibians: ['reptile', 'reptiles', 'amphibian', 'amphibians', 'snake', 'lizard', 'turtle', 'crocodile', 'alligator', 'frog', 'salamander'],
    behavior_intelligence: ['behavior', 'intelligence', 'communication', 'tool use', 'memory', 'social structure', 'learning', 'cognition'],
    conservation: ['conservation', 'endangered', 'extinction', 'iucn', 'habitat loss', 'threatened', 'vulnerable', 'least concern'],
    adaptations: ['adaptation', 'adaptations', 'camouflage', 'mimicry', 'venom', 'speed', 'survival', 'record', 'extreme'],
  },
  human_body_health: {
    anatomy_organs: ['anatomy', 'organ', 'organs', 'bone', 'muscle', 'skeleton', 'tissue', 'lungs', 'liver', 'kidney', 'skin'],
    brain_neuro: ['brain', 'neuro', 'neuroscience', 'neuron', 'nervous system', 'cognition', 'memory', 'sleep', 'psychology'],
    genetics_dna: ['gene', 'genes', 'genetics', 'dna', 'chromosome', 'mutation', 'genome', 'heredity', 'protein-coding'],
    cardiovascular: ['heart', 'blood', 'artery', 'vein', 'circulation', 'cardiovascular', 'blood pressure', 'red blood cell', 'cardiology'],
    digestion_metabolism: ['digestion', 'digestive', 'stomach', 'intestine', 'gut', 'metabolism', 'enzyme', 'calorie', 'nutrient', 'glycolysis'],
    senses_perception: ['vision', 'hearing', 'taste', 'smell', 'touch', 'perception', 'eye', 'ear', 'retina', 'pain'],
    immunity_disease: ['immune', 'immunity', 'disease', 'virus', 'bacteria', 'infection', 'vaccine', 'allergy', 'pathogen'],
    medical_science: ['medical', 'medicine', 'surgery', 'diagnostic', 'treatment', 'clinical', 'hospital', 'imaging', 'therapeutic'],
  },
  food_cuisine: {
    european_cuisine: ['european cuisine', 'french', 'italian', 'spanish', 'german', 'british', 'scandinavian', 'netherlands', 'portuguese'],
    asian_cuisine: ['asian cuisine', 'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'indian', 'indonesia', 'malaysian', 'filipino'],
    world_cuisine: ['african cuisine', 'middle eastern', 'arab', 'latin american', 'mexican', 'caribbean', 'turkish', 'ethiopian', 'peruvian', 'brazilian'],
    baking_desserts: ['baking', 'dessert', 'pastry', 'cake', 'cookie', 'bread', 'chocolate', 'pie', 'waffle', 'crepe'],
    fermentation_beverages: ['fermentation', 'fermented', 'beer', 'wine', 'coffee', 'tea', 'sake', 'kombucha', 'pickle', 'brew'],
    food_history: ['food history', 'origin', 'invented', 'century', 'ancient', 'tradition', 'trade route', 'culinary history'],
    food_science: ['food science', 'chemistry', 'maillard', 'emulsion', 'preservation', 'nutrition', 'molecular', 'capsaicin', 'umami', 'technique'],
    ingredients_spices: ['ingredient', 'ingredients', 'spice', 'spices', 'saffron', 'cinnamon', 'pepper', 'salt', 'sugar', 'herb', 'garlic', 'onion'],
  },
  art_architecture: {
    museums_institutions: ['museum', 'gallery', 'institute', 'collection', 'foundation'],
    historic_buildings: ['castle', 'palace', 'temple', 'cathedral', 'fortress', 'abbey', 'church', 'mosque', 'monument', 'ruins', 'historic building'],
    painting_visual: ['painting', 'painter', 'canvas', 'fresco', 'portrait', 'impressionism', 'surrealism', 'vermeer', 'van gogh', 'monet', 'picasso'],
    sculpture_decorative: ['sculpture', 'statue', 'pottery', 'ceramic', 'mosaic', 'jewelry', 'tapestry', 'carving', 'decorative'],
    modern_contemporary: ['modern art', 'contemporary', 'installation', 'digital art', '20th century', '21st century', 'avant garde'],
    architectural_styles: ['gothic', 'baroque', 'art deco', 'brutalism', 'modernism', 'romanesque', 'byzantine', 'architectural style'],
    engineering_design: ['bridge', 'dam', 'skyscraper', 'engineering', 'structural', 'construction', 'infrastructure', 'design'],
  },
}

const DOMAIN_ALIASES = new Map([
  ['general knowledge', 'general_knowledge'],
  ['general_knowledge', 'general_knowledge'],
  ['natural sciences', 'natural_sciences'],
  ['natural_sciences', 'natural_sciences'],
  ['science', 'natural_sciences'],
  ['space astronomy', 'space_astronomy'],
  ['space and astronomy', 'space_astronomy'],
  ['space astronomy', 'space_astronomy'],
  ['geography', 'geography'],
  ['history', 'history'],
  ['mythology folklore', 'mythology_folklore'],
  ['mythology and folklore', 'mythology_folklore'],
  ['animals wildlife', 'animals_wildlife'],
  ['animals and wildlife', 'animals_wildlife'],
  ['human body health', 'human_body_health'],
  ['human body and health', 'human_body_health'],
  ['food world cuisine', 'food_cuisine'],
  ['food and world cuisine', 'food_cuisine'],
  ['food cuisine', 'food_cuisine'],
  ['art architecture', 'art_architecture'],
  ['art and architecture', 'art_architecture'],
  ['technology', 'general_knowledge'],
  ['math', 'general_knowledge'],
  ['mathematics', 'general_knowledge'],
  ['medicine', 'human_body_health'],
  ['health', 'human_body_health'],
  ['culture', 'art_architecture'],
  ['life sciences', 'human_body_health'],
  ['language', 'language'],
])

const LEGACY_TOP_LEVEL_KEYS = new Set([
  'technology',
  'math',
  'mathematics',
  'medicine',
  'health',
  'culture',
  'life sciences',
])

const DOMAIN_SET = new Set(Object.keys(TAXONOMY))
const VALID_SUBCATEGORY = Object.fromEntries(
  Object.entries(TAXONOMY).map(([domain, ids]) => [domain, new Set(ids)]),
)

const { values } = parseArgs({
  options: {
    write: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    limit: { type: 'string' },
    'per-domain-limit': { type: 'string' },
    'allow-fallback': { type: 'string', default: 'false' },
    'min-score': { type: 'string', default: '2' },
    'include-legacy-top': { type: 'string', default: 'false' },
    'include-generated': { type: 'string', default: 'true' },
    'include-seed': { type: 'string', default: 'true' },
    report: { type: 'string', default: path.join('data', 'generated', 'qa-reports', 'subcategory-backfill-report.json') },
  },
})

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeKey(value) {
  return normalizeText(value)
}

function isValidSubcategoryId(domain, id) {
  return Boolean(domain && id && VALID_SUBCATEGORY[domain]?.has(id))
}

function inferDomainFromPath(filePath) {
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase()
  if (DOMAIN_SET.has(base)) return base
  if (base.startsWith('geography-')) return 'geography'
  if (base.startsWith('space-')) return 'space_astronomy'
  if (base.startsWith('general-')) return 'general_knowledge'
  return null
}

function resolveDomain(fact, fileHint = null, options = {}) {
  const includeLegacyTop = options.includeLegacyTop === true
  const categoryArray = Array.isArray(fact.category)
    ? fact.category
    : typeof fact.category === 'string' && fact.category.trim()
      ? [fact.category]
      : []
  const top = categoryArray[0] ?? fact.categoryL1 ?? ''
  const topKey = normalizeKey(top)
  if (!includeLegacyTop && LEGACY_TOP_LEVEL_KEYS.has(topKey)) {
    return null
  }
  const mappedTop = DOMAIN_ALIASES.get(topKey)
  if (mappedTop) return mappedTop
  if (DOMAIN_SET.has(topKey)) return topKey

  const hintKey = fileHint ? normalizeKey(fileHint) : ''
  const mappedHint = DOMAIN_ALIASES.get(hintKey)
  if (mappedHint) return mappedHint
  if (DOMAIN_SET.has(hintKey)) return hintKey

  const id = String(fact.id ?? '').toLowerCase()
  if (id.startsWith('geo-')) return 'geography'
  if (id.startsWith('hist-')) return 'history'
  if (id.startsWith('myth-')) return 'mythology_folklore'
  if (id.startsWith('animal-')) return 'animals_wildlife'
  if (id.startsWith('gk-') || id.startsWith('tech-')) return 'general_knowledge'
  if (id.startsWith('nsci-')) return 'natural_sciences'
  if (id.startsWith('health-') || id.startsWith('human-')) return 'human_body_health'
  if (id.startsWith('food-')) return 'food_cuisine'
  if (id.startsWith('art-')) return 'art_architecture'
  return null
}

function legacyAliasLookup(domain, valuesToCheck) {
  const aliases = LEGACY_SUBCATEGORY_ALIASES[domain]
  if (!aliases) return null
  for (const candidate of valuesToCheck) {
    const key = normalizeKey(candidate)
    if (!key) continue
    if (aliases[key]) return aliases[key]
  }
  return null
}

function countKeywordMatches(context, keyword) {
  const key = normalizeText(keyword)
  if (!key) return 0
  if (key.includes(' ')) return context.text.includes(key) ? 2 : 0
  return context.words.has(key) ? 1 : 0
}

function buildContext(fact) {
  const tags = Array.isArray(fact.tags) ? fact.tags : []
  const category = Array.isArray(fact.category)
    ? fact.category
    : typeof fact.category === 'string' && fact.category.trim()
      ? [fact.category]
      : []
  const parts = [
    fact.statement,
    fact.quizQuestion,
    fact.correctAnswer,
    fact.explanation,
    fact.wowFactor,
    fact.sourceName,
    fact.sourceUrl,
    fact.categoryL1,
    fact.categoryL2,
    fact.categoryL3,
    ...category,
    ...tags,
  ].filter(Boolean)
  const text = normalizeText(parts.join(' '))
  return {
    text,
    words: new Set(text.split(' ').filter(Boolean)),
  }
}

function inferHistoricalEra(text) {
  const yearMatches = [...text.matchAll(/\b(\d{3,4})\b/g)].map((match) => Number(match[1]))
  if (yearMatches.length === 0) return null
  const year = yearMatches[0]
  if (Number.isNaN(year)) return null
  if (year < 500) return 'ancient_classical'
  if (year < 1500) return 'medieval'
  if (year < 1800) return 'early_modern'
  return 'modern_contemporary'
}

function scoreSubcategory(domain, fact) {
  const context = buildContext(fact)
  const rules = SUBCATEGORY_KEYWORDS[domain]
  if (!rules) return { winner: null, score: 0, secondScore: 0 }

  const scores = []
  for (const [subcategoryId, keywords] of Object.entries(rules)) {
    let score = 0
    for (const keyword of keywords) {
      score += countKeywordMatches(context, keyword)
    }
    scores.push({ subcategoryId, score })
  }

  if (domain === 'history') {
    const era = inferHistoricalEra(context.text)
    if (era) {
      const entry = scores.find((item) => item.subcategoryId === era)
      if (entry) entry.score += 1
    }
  }

  scores.sort((left, right) => right.score - left.score || left.subcategoryId.localeCompare(right.subcategoryId))
  const winner = scores[0]
  const runnerUp = scores[1]
  return {
    winner: winner?.subcategoryId ?? null,
    score: winner?.score ?? 0,
    secondScore: runnerUp?.score ?? 0,
  }
}

function getCategoryArray(fact) {
  if (Array.isArray(fact.category)) return [...fact.category]
  if (typeof fact.category === 'string' && fact.category.trim()) return [fact.category.trim()]
  return []
}

function classifyFact(domain, fact, force = false) {
  const existing = normalizeText(fact.categoryL2)
  if (!force && isValidSubcategoryId(domain, existing)) {
    return { subcategoryId: existing, reason: 'kept', score: 0 }
  }

  const categoryArray = getCategoryArray(fact)
  const categoryCandidates = [fact.categoryL2, categoryArray[1], categoryArray[2]].filter(Boolean)
  const legacyMapped = legacyAliasLookup(domain, categoryCandidates)
  if (legacyMapped && isValidSubcategoryId(domain, legacyMapped)) {
    return { subcategoryId: legacyMapped, reason: 'legacy', score: 100 }
  }

  const scored = scoreSubcategory(domain, fact)
  if (scored.winner && scored.score > 0 && isValidSubcategoryId(domain, scored.winner)) {
    return { subcategoryId: scored.winner, reason: 'scored', score: scored.score, secondScore: scored.secondScore }
  }

  const fallback = DEFAULT_SUBCATEGORY[domain]
  return { subcategoryId: fallback, reason: 'fallback', score: 0 }
}

function applyClassification(fact, domain, classification) {
  const before = JSON.stringify(fact)

  const category = getCategoryArray(fact)
  if (category.length === 0) category.push(domain)

  const previousSecondary = category[1]
  category[1] = classification.subcategoryId
  if (previousSecondary && previousSecondary !== classification.subcategoryId && !category[2]) {
    category[2] = previousSecondary
  }

  fact.category = category
  fact.categoryL1 = DOMAIN_LABELS[domain]
  fact.categoryL2 = classification.subcategoryId
  if (!fact.categoryL3 && category[2]) {
    fact.categoryL3 = category[2]
  }

  const after = JSON.stringify(fact)
  return before !== after
}

function createStatsContainer() {
  const perDomain = {}
  for (const domain of Object.keys(TAXONOMY)) {
    perDomain[domain] = {
      total: 0,
      updated: 0,
      kept: 0,
      legacy: 0,
      scored: 0,
      fallback: 0,
      unresolvedDomain: 0,
      skippedByLimit: 0,
      skippedLowConfidence: 0,
      bySubcategory: Object.fromEntries(TAXONOMY[domain].map((id) => [id, 0])),
    }
  }
  return perDomain
}

async function collectGeneratedFiles() {
  const dir = path.join(ROOT, 'data', 'generated')
  let entries = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith('.jsonl'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(dir, name))
}

async function collectSeedFiles() {
  const dir = path.join(ROOT, 'src', 'data', 'seed')
  let entries = []
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }
  return entries
    .filter((name) => name.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right))
    .map((name) => path.join(dir, name))
}

function parsePositiveInt(value, label) {
  if (value == null) return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return parsed
}

function parseBoolean(value, label) {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'true' || key === '1' || key === 'yes' || key === 'y') return true
  if (key === 'false' || key === '0' || key === 'no' || key === 'n') return false
  throw new Error(`Invalid ${label}: ${value}`)
}

function shouldSkipByLimit(domain, limitState) {
  if (limitState.globalRemaining <= 0) return true
  if (limitState.perDomainLimit == null) return false
  const used = limitState.perDomainUsed.get(domain) ?? 0
  return used >= limitState.perDomainLimit
}

function consumeLimit(domain, limitState) {
  if (limitState.globalRemaining > 0) {
    limitState.globalRemaining -= 1
  }
  if (limitState.perDomainLimit != null) {
    const used = limitState.perDomainUsed.get(domain) ?? 0
    limitState.perDomainUsed.set(domain, used + 1)
  }
}

async function processJsonlFile(filePath, options) {
  const relPath = path.relative(ROOT, filePath)
  const text = await fs.readFile(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const fileHint = inferDomainFromPath(filePath)
  const nextLines = []

  let changedRows = 0
  const perDomain = options.perDomain

  for (const [index, line] of lines.entries()) {
    let fact
    try {
      fact = JSON.parse(line)
    } catch (error) {
      throw new Error(`Failed to parse JSONL line ${index + 1} in ${relPath}: ${error.message}`)
    }
    const domain = resolveDomain(fact, fileHint, options)
    if (!domain || !DOMAIN_SET.has(domain)) {
      nextLines.push(JSON.stringify(fact))
      continue
    }

    perDomain[domain].total += 1
    if (shouldSkipByLimit(domain, options.limitState)) {
      perDomain[domain].skippedByLimit += 1
      nextLines.push(JSON.stringify(fact))
      continue
    }

    const beforeL2 = normalizeText(fact.categoryL2)
    const categoryBefore = getCategoryArray(fact)
    const beforeSecondary = normalizeText(categoryBefore[1])
    const classification = classifyFact(domain, fact, options.force)
    if (
      (classification.reason === 'fallback' && !options.allowFallback) ||
      (classification.reason === 'scored' && classification.score < options.minScore)
    ) {
      perDomain[domain].skippedLowConfidence += 1
      nextLines.push(JSON.stringify(fact))
      continue
    }
    perDomain[domain][classification.reason] += 1
    perDomain[domain].bySubcategory[classification.subcategoryId] += 1

    const changed = applyClassification(fact, domain, classification)
    if (changed) {
      changedRows += 1
      perDomain[domain].updated += 1
      consumeLimit(domain, options.limitState)
      if (options.samples.length < options.maxSamples) {
        options.samples.push({
          path: relPath,
          id: fact.id ?? null,
          domain,
          reason: classification.reason,
          fromCategoryL2: beforeL2 || null,
          fromCategorySecondary: beforeSecondary || null,
          toCategoryL2: classification.subcategoryId,
          statement: String(fact.statement ?? '').slice(0, 220),
        })
      }
    }
    nextLines.push(JSON.stringify(fact))
  }

  if (options.write && changedRows > 0) {
    await fs.writeFile(filePath, `${nextLines.join('\n')}\n`, 'utf8')
  }

  return {
    path: relPath,
    type: 'jsonl',
    totalRows: lines.length,
    changedRows,
  }
}

async function processJsonFile(filePath, options) {
  const relPath = path.relative(ROOT, filePath)
  const raw = await fs.readFile(filePath, 'utf8')
  let facts
  try {
    facts = JSON.parse(raw)
  } catch (error) {
    throw new Error(`Failed to parse JSON file ${relPath}: ${error.message}`)
  }
  if (!Array.isArray(facts)) {
    return {
      path: relPath,
      type: 'json',
      totalRows: 0,
      changedRows: 0,
      skipped: true,
      reason: 'not_array',
    }
  }

  const fileHint = inferDomainFromPath(filePath)
  const perDomain = options.perDomain
  let changedRows = 0

  for (const fact of facts) {
    if (!fact || typeof fact !== 'object') continue
    const domain = resolveDomain(fact, fileHint, options)
    if (!domain || !DOMAIN_SET.has(domain)) continue

    perDomain[domain].total += 1
    if (shouldSkipByLimit(domain, options.limitState)) {
      perDomain[domain].skippedByLimit += 1
      continue
    }

    const beforeL2 = normalizeText(fact.categoryL2)
    const categoryBefore = getCategoryArray(fact)
    const beforeSecondary = normalizeText(categoryBefore[1])
    const classification = classifyFact(domain, fact, options.force)
    if (
      (classification.reason === 'fallback' && !options.allowFallback) ||
      (classification.reason === 'scored' && classification.score < options.minScore)
    ) {
      perDomain[domain].skippedLowConfidence += 1
      continue
    }
    perDomain[domain][classification.reason] += 1
    perDomain[domain].bySubcategory[classification.subcategoryId] += 1

    const changed = applyClassification(fact, domain, classification)
    if (changed) {
      changedRows += 1
      perDomain[domain].updated += 1
      consumeLimit(domain, options.limitState)
      if (options.samples.length < options.maxSamples) {
        options.samples.push({
          path: relPath,
          id: fact.id ?? null,
          domain,
          reason: classification.reason,
          fromCategoryL2: beforeL2 || null,
          fromCategorySecondary: beforeSecondary || null,
          toCategoryL2: classification.subcategoryId,
          statement: String(fact.statement ?? '').slice(0, 220),
        })
      }
    }
  }

  if (options.write && changedRows > 0) {
    await fs.writeFile(filePath, `${JSON.stringify(facts, null, 2)}\n`, 'utf8')
  }

  return {
    path: relPath,
    type: 'json',
    totalRows: facts.length,
    changedRows,
  }
}

function summarizeTotals(perDomain) {
  const totals = {
    rows: 0,
    updated: 0,
    kept: 0,
    legacy: 0,
    scored: 0,
    fallback: 0,
  }
  for (const domain of Object.keys(perDomain)) {
    const stats = perDomain[domain]
    totals.rows += stats.total
    totals.updated += stats.updated
    totals.kept += stats.kept
    totals.legacy += stats.legacy
    totals.scored += stats.scored
    totals.fallback += stats.fallback
  }
  return totals
}

async function main() {
  const globalLimit = parsePositiveInt(values.limit, 'limit')
  const perDomainLimit = parsePositiveInt(values['per-domain-limit'], 'per-domain-limit')
  const minScore = parsePositiveInt(values['min-score'], 'min-score')
  const allowFallback = parseBoolean(values['allow-fallback'], 'allow-fallback')
  const includeLegacyTop = parseBoolean(values['include-legacy-top'], 'include-legacy-top')
  const includeGenerated = parseBoolean(values['include-generated'], 'include-generated')
  const includeSeed = parseBoolean(values['include-seed'], 'include-seed')
  const perDomain = createStatsContainer()
  const fileReports = []
  const samples = []
  const limitState = {
    globalRemaining: globalLimit ?? Number.POSITIVE_INFINITY,
    perDomainLimit,
    perDomainUsed: new Map(),
  }

  if (includeGenerated) {
    const generatedFiles = await collectGeneratedFiles()
    for (const filePath of generatedFiles) {
      const report = await processJsonlFile(filePath, {
        write: values.write,
        force: values.force,
        minScore,
        allowFallback,
        includeLegacyTop,
        perDomain,
        limitState,
        samples,
        maxSamples: 100,
      })
      fileReports.push(report)
    }
  }

  if (includeSeed) {
    const seedFiles = await collectSeedFiles()
    for (const filePath of seedFiles) {
      const report = await processJsonFile(filePath, {
        write: values.write,
        force: values.force,
        minScore,
        allowFallback,
        includeLegacyTop,
        perDomain,
        limitState,
        samples,
        maxSamples: 100,
      })
      fileReports.push(report)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: values.write ? 'write' : 'dry_run',
    options: {
      force: values.force,
      limit: globalLimit,
      perDomainLimit,
      minScore,
      allowFallback,
      includeLegacyTop,
      includeGenerated,
      includeSeed,
    },
    totals: summarizeTotals(perDomain),
    perDomain,
    files: fileReports,
    samples,
  }

  const reportPath = path.resolve(ROOT, values.report)
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  const touchedFiles = fileReports.filter((item) => item.changedRows > 0).length
  console.log(`[subcategory-backfill] mode=${report.mode}`)
  console.log(`[subcategory-backfill] rows=${report.totals.rows}, updated=${report.totals.updated}, files_changed=${touchedFiles}`)
  console.log(`[subcategory-backfill] kept=${report.totals.kept}, legacy=${report.totals.legacy}, scored=${report.totals.scored}, fallback=${report.totals.fallback}`)
  console.log(`[subcategory-backfill] report=${path.relative(ROOT, reportPath)}`)

  for (const domain of Object.keys(perDomain)) {
    const stats = perDomain[domain]
    if (stats.total === 0) continue
    const topSubcategories = Object.entries(stats.bySubcategory)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([subcategoryId, count]) => `${subcategoryId}:${count}`)
      .join(', ')
    console.log(`  - ${domain}: total=${stats.total}, updated=${stats.updated}, fallback=${stats.fallback}, skippedLow=${stats.skippedLowConfidence}, top=${topSubcategories}`)
  }
}

main().catch((error) => {
  console.error('[subcategory-backfill] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
