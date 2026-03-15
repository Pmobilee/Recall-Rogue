/**
 * select-entities.mjs
 *
 * Selects entities for each game domain from the enriched Vital Articles data,
 * applying subcategory quotas and notability filtering. This is the critical
 * entity curation step between enrichment and fact generation.
 *
 * Input:  data/raw/vital-articles-l4.json — enriched array with:
 *           {title, qid, wikiCategory, label, description, sitelinks,
 *            monthlyPageviews, instanceOf, properties}
 *
 * Output: data/curated/{domain}/entities.json — per-domain curated entity lists
 *
 * Usage:
 *   node scripts/content-pipeline/curate/select-entities.mjs
 *   node scripts/content-pipeline/curate/select-entities.mjs --domain animals_wildlife
 *   node scripts/content-pipeline/curate/select-entities.mjs --target 700 --min-sitelinks 30
 *   node scripts/content-pipeline/curate/select-entities.mjs --input data/raw/my-enriched.json
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJson, readJson, parseCliArgs } from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

// ---------------------------------------------------------------------------
// Domain mapping — Wikipedia category substrings → game domain
// ---------------------------------------------------------------------------
// Entries are ordered most-specific first so that substring matching finds
// the most precise match before falling through to broader categories.

const WIKI_TO_DOMAIN_RULES = [
  // Biology sub-categories — most specific first
  { match: 'Biology/Animals', domain: 'animals_wildlife' },
  { match: 'Biology/Plants', domain: 'natural_sciences' },
  // NOTE: generic 'Biology' rule removed — "Biology and health sciences" is handled
  // in mapToDomain() below with instanceOf/description-based routing.

  // Sciences — "Physical sciences" is the L4 top-level; sub-matches first
  { match: 'Astronomy', domain: 'space_astronomy' },
  { match: 'Physics', domain: 'natural_sciences' },
  { match: 'Chemistry', domain: 'natural_sciences' },
  { match: 'Earth science', domain: 'natural_sciences' },
  { match: 'Mathematics', domain: 'natural_sciences' },
  { match: 'Physical sciences', domain: 'natural_sciences' }, // L4 top-level
  { match: 'Technology', domain: 'general_knowledge' },

  // Arts (Music included in arts domain)
  { match: 'Music', domain: 'art_architecture' },
  { match: 'Arts', domain: 'art_architecture' },

  // Social / humanities
  { match: 'Philosophy', domain: 'general_knowledge' },
  { match: 'Society and social sciences', domain: 'general_knowledge' },
  { match: 'Social sciences', domain: 'general_knowledge' },
  { match: 'Everyday life', domain: 'general_knowledge' },

  // World knowledge domains
  { match: 'History', domain: 'history' },
  { match: 'Geography', domain: 'geography' },
  { match: 'Food', domain: 'food_cuisine' },
  { match: 'Religion', domain: 'mythology_folklore' },
  { match: 'Mythology', domain: 'mythology_folklore' },

  // People — handled specially in mapToDomain() below, NOT via simple substring
]

/**
 * Wikidata occupation Q-IDs → game domain for People routing.
 * Only the most common/relevant ones; fallback is 'history'.
 */
const OCCUPATION_TO_DOMAIN = {
  // Scientists → natural_sciences
  Q901: 'natural_sciences',     // scientist
  Q169470: 'natural_sciences',  // physicist
  Q593644: 'natural_sciences',  // chemist
  Q864503: 'natural_sciences',  // biologist
  Q170790: 'natural_sciences',  // mathematician
  Q11063: 'space_astronomy',    // astronomer
  Q11513337: 'space_astronomy', // astronaut

  // Artists → art_architecture
  Q1028181: 'art_architecture', // painter
  Q1281618: 'art_architecture', // sculptor
  Q42973: 'art_architecture',   // architect
  Q33999: 'art_architecture',   // actor
  Q177220: 'art_architecture',  // singer
  Q36834: 'art_architecture',   // composer
  Q639669: 'art_architecture',  // musician

  // Medical → human_body_health
  Q39631: 'human_body_health',  // physician

  // General Knowledge (tech/business/sport)
  Q131524: 'general_knowledge', // entrepreneur
  Q82594: 'general_knowledge',  // computer scientist
  Q937857: 'general_knowledge', // football player
}

/**
 * Map an entity to a game domain ID.
 * Uses wikiCategory rules for most entities; for "People", routes based on
 * occupation properties to distribute across domains rather than dumping all
 * into history.
 *
 * @param {string} wikiCategory
 * @param {object} entity — full entity object (for People routing)
 * @returns {string|null}
 */
function mapToDomain(wikiCategory, entity) {
  if (!wikiCategory) return null

  // Standard category-based rules (non-People)
  for (const rule of WIKI_TO_DOMAIN_RULES) {
    if (wikiCategory.includes(rule.match)) return rule.domain
  }

  // Biology routing — split animals, plants, and health entities
  // Handles "Biology and health sciences" (the actual L4 wikiCategory value)
  if (wikiCategory.includes('Biology')) {
    const types = entity?.instanceOf || []
    const desc = (entity?.description || '').toLowerCase()

    // Q16521 = taxon — most animals and plants are typed as taxon
    const isTaxon = types.includes('Q16521')

    // Animals: taxon + animal-related description keywords
    if (isTaxon && desc.match(/species|mammal|bird|fish|reptile|amphibian|insect|arachnid|shark|whale|dolphin|snake|lizard|turtle|frog|crab|lobster|shrimp|octopus|squid|coral|worm|beetle|butterfly|moth|ant|bee|wasp|spider|scorpion|primate|rodent|carnivore|herbivore|predator|animal|fauna/)) {
      return 'animals_wildlife'
    }

    // Also check instanceOf for animal-specific Q-IDs
    const ANIMAL_QIDS = ['Q729', 'Q7377', 'Q5113', 'Q152', 'Q1390', 'Q28425', 'Q10884', 'Q29518', 'Q1662', 'Q11617', 'Q53636', 'Q10908', 'Q36611', 'Q188749', 'Q25364']
    if (types.some(t => ANIMAL_QIDS.includes(t))) {
      return 'animals_wildlife'
    }

    // Plants: taxon + plant-related description keywords
    if (isTaxon && desc.match(/plant|tree|flower|fungus|fungi|fern|moss|algae|lichen|grass|shrub|crop|fruit|vegetable|herb|flora|photosynthetic|angiosperm|gymnosperm|conifer|palm|orchid|cactus/)) {
      return 'natural_sciences'  // botany_plants subcategory
    }

    // Plant Q-IDs
    const PLANT_QIDS = ['Q756', 'Q506']
    if (types.some(t => PLANT_QIDS.includes(t))) {
      return 'natural_sciences'
    }

    // Generic taxon without clear animal/plant signal — check more broadly
    if (isTaxon) {
      // If it's a taxon but we can't tell animal vs plant, check for marine/aquatic
      if (desc.match(/marine|aquatic|freshwater|sea|ocean/)) return 'animals_wildlife'
      // Default taxons to animals_wildlife (most Vital Articles biology taxons are animals)
      return 'animals_wildlife'
    }

    // Non-taxon biology: diseases, anatomy, health topics → human_body_health
    return 'human_body_health'
  }

  // People routing — check occupation and description keywords
  if (wikiCategory === 'People' || wikiCategory.startsWith('People/')) {
    // Check occupation property (may be a Q-ID string)
    const occ = entity?.properties?.occupation
    if (occ && OCCUPATION_TO_DOMAIN[occ]) return OCCUPATION_TO_DOMAIN[occ]

    // Check fieldOfWork property
    const field = entity?.properties?.fieldOfWork
    if (field && OCCUPATION_TO_DOMAIN[field]) return OCCUPATION_TO_DOMAIN[field]

    // Fallback: keyword search on description
    const desc = (entity?.description || '').toLowerCase()
    if (desc.includes('physicist') || desc.includes('chemist') || desc.includes('biologist') || desc.includes('mathematician') || desc.includes('scientist') || desc.includes('botanist') || desc.includes('geologist'))
      return 'natural_sciences'
    if (desc.includes('astronomer') || desc.includes('astronaut') || desc.includes('astrophysicist') || desc.includes('cosmonaut'))
      return 'space_astronomy'
    if (desc.includes('painter') || desc.includes('sculptor') || desc.includes('architect') || desc.includes('composer') || desc.includes('musician') || desc.includes('singer') || desc.includes('artist') || desc.includes('actor') || desc.includes('actress') || desc.includes('filmmaker') || desc.includes('director') || desc.includes('photographer') || desc.includes('poet') || desc.includes('writer') || desc.includes('author') || desc.includes('novelist') || desc.includes('playwright'))
      return 'art_architecture'
    if (desc.includes('physician') || desc.includes('surgeon') || desc.includes('medical') || desc.includes('nurse') || desc.includes('pharmacist') || desc.includes('psychologist') || desc.includes('neuroscientist'))
      return 'human_body_health'
    if (desc.includes('explorer') || desc.includes('geographer') || desc.includes('cartographer') || desc.includes('navigator'))
      return 'geography'
    if (desc.includes('chef') || desc.includes('cook') || desc.includes('gastronom'))
      return 'food_cuisine'
    if (desc.includes('mytholog') || desc.includes('theologian') || desc.includes('religious'))
      return 'mythology_folklore'
    if (desc.includes('inventor') || desc.includes('engineer') || desc.includes('entrepreneur') || desc.includes('computer') || desc.includes('programmer'))
      return 'general_knowledge'

    // Default: history (political leaders, military figures, historical persons)
    return 'history'
  }

  return null
}

// ---------------------------------------------------------------------------
// Subcategory quotas (proportional targets per domain)
// NOTE: subcategory IDs match src/data/subcategoryTaxonomy.ts exactly.
// ---------------------------------------------------------------------------

const QUOTAS = {
  history: {
    ancient_classical: 0.14,
    medieval: 0.10,
    early_modern: 0.10,
    // colonial_revolutions and industrial_era map to early_modern / modern_contemporary
    modern_contemporary: 0.18, // covers industrial_era + cold_war_modern + colonial_revolutions
    world_wars: 0.17,
    battles_military: 0.09,
    social_cultural: 0.14,
    people_leaders: 0.08,
  },
  animals_wildlife: {
    mammals: 0.16,
    birds: 0.12,
    marine_life: 0.14,
    reptiles_amphibians: 0.10,
    insects_arachnids: 0.10,
    behavior_intelligence: 0.15,
    conservation: 0.10,
    adaptations: 0.13,
  },
  space_astronomy: {
    planets_moons: 0.18,
    stars_galaxies: 0.15,
    missions_spacecraft: 0.15,
    cosmology_universe: 0.12,
    satellites_tech: 0.12,
    exoplanets_astrobio: 0.08,
    // astronomical_records and astronauts folded into other subcategories
  },
  natural_sciences: {
    physics_mechanics: 0.18,
    chemistry_elements: 0.16,
    biology_organisms: 0.14,
    geology_earth: 0.12,
    ecology_environment: 0.10,
    materials_engineering: 0.10,
    // scientific_discoveries and math_numbers distributed below
    botany_plants: 0.10,
    // remainder → biology_organisms
  },
  general_knowledge: {
    records_firsts: 0.15,
    inventions_tech: 0.15,
    words_language: 0.12,
    // famous_firsts merged into records_firsts
    // money_economics → oddities
    // symbols_flags → general
    // calendar_time → general
    // transportation → inventions_tech
    everyday_science: 0.10,
    oddities: 0.15,
    // landmarks_wonders and pop_culture take the rest
    landmarks_wonders: 0.15,
    pop_culture: 0.18,
  },
  mythology_folklore: {
    greek_roman: 0.20,
    norse_celtic: 0.15,
    eastern_myths: 0.15,
    creatures_monsters: 0.15,
    creation_cosmology: 0.10,
    folk_legends: 0.15,
    gods_deities: 0.10,
  },
  human_body_health: {
    anatomy_organs: 0.14,
    brain_neuro: 0.14,
    immunity_disease: 0.12,
    cardiovascular: 0.10,
    digestion_metabolism: 0.12,
    senses_perception: 0.10,
    genetics_dna: 0.12,
    medical_science: 0.16,
  },
  food_cuisine: {
    food_history: 0.15,
    asian_cuisine: 0.15,
    european_cuisine: 0.12,
    world_cuisine: 0.10,
    ingredients_spices: 0.12,
    food_science: 0.10,
    fermentation_beverages: 0.10,
    baking_desserts: 0.08,
    // food_records → food_history
  },
  art_architecture: {
    painting_visual: 0.18,
    sculpture_decorative: 0.12,
    architectural_styles: 0.15,
    historic_buildings: 0.15,
    modern_contemporary: 0.12,
    museums_institutions: 0.10,
    // art_movements → painting_visual
    engineering_design: 0.08,
    // remainder → painting_visual
  },
  geography: {
    africa: 0.10,
    asia_oceania: 0.15,
    europe: 0.15,
    americas: 0.15,
    landforms_water: 0.20,
    extreme_records: 0.15,
    climate_biomes: 0.10,
  },
}

// ---------------------------------------------------------------------------
// Subcategory assignment rules per domain
// Each rule: { subcategoryId, priority, match: (entity) => boolean }
// Rules are evaluated highest priority first; first match wins.
// ---------------------------------------------------------------------------

/**
 * Wikidata instanceOf QIDs useful for classification.
 * Sourced from common Vital Articles entity types.
 */
const Q = {
  // Animals
  ANIMAL: 'Q729',
  MAMMAL: 'Q7377',
  BIRD: 'Q5113',
  FISH: 'Q152',
  MARINE_MAMMAL: 'Q1390',
  SHARK: 'Q28425',
  REPTILE: 'Q10884',
  SNAKE: 'Q29518',
  TURTLE: 'Q1662',
  LIZARD: 'Q11617',
  FROG: 'Q53636',
  AMPHIBIAN: 'Q10908',
  INSECT: 'Q1390195',
  SPIDER: 'Q1390195',
  ARTHROPOD: 'Q1390195',
  CETACEAN: 'Q36611',  // whales/dolphins
  CEPHALOPOD: 'Q188749',
  CRUSTACEAN: 'Q25364',

  // Plants
  PLANT: 'Q756',
  TREE: 'Q10884',
  FLOWER: 'Q506',

  // Astronomy
  PLANET: 'Q634',
  MOON: 'Q2537',
  DWARF_PLANET: 'Q101600',
  ASTEROID: 'Q3863',
  COMET: 'Q3559',
  STAR: 'Q523',
  GALAXY: 'Q318',
  NEBULA: 'Q12029',
  BLACK_HOLE: 'Q1169522',
  SPACE_MISSION: 'Q24045896',
  SPACECRAFT: 'Q40218',
  SATELLITE: 'Q5522',
  SPACE_TELESCOPE: 'Q4169',
  SPACE_STATION: 'Q1385072',
  ASTRONAUT: 'Q11631',
  EXOPLANET: 'Q44559',

  // Chemistry / materials
  CHEMICAL_ELEMENT: 'Q11344',
  CHEMICAL_COMPOUND: 'Q11173',
  MINERAL: 'Q7946',
  ALLOY: 'Q37756',

  // Geology
  VOLCANO: 'Q8072',
  MOUNTAIN: 'Q8502',
  RIVER: 'Q4022',
  LAKE: 'Q23397',
  ISLAND: 'Q23442',
  CAVE: 'Q35509',
  DESERT: 'Q8514',
  OCEAN: 'Q9430',

  // People
  HUMAN: 'Q5',
  POLITICIAN: 'Q82955',
  MILITARY_PERSON: 'Q47064',
  SCIENTIST: 'Q901',
  ARTIST: 'Q483501',
  MONARCH: 'Q116',
  PRESIDENT: 'Q30461',

  // Events
  WAR: 'Q198',
  BATTLE: 'Q178561',
  CONFLICT: 'Q180684',
  REVOLUTION: 'Q10931',

  // Art / architecture
  PAINTING: 'Q3305213',
  SCULPTURE: 'Q860861',
  BUILDING: 'Q41176',
  CHURCH: 'Q16970',
  MUSEUM: 'Q33506',
  TEMPLE: 'Q44539',
  CASTLE: 'Q23413',
  PALACE: 'Q16560',
  BRIDGE: 'Q12280',
  TOWER: 'Q17514',
  STADIUM: 'Q483110',

  // Food
  FOOD: 'Q2095',
  DISH: 'Q746549',
  BEVERAGE: 'Q40050',
  SPICE: 'Q42527',
  INGREDIENT: 'Q10675206',

  // Mythology
  MYTHICAL_CREATURE: 'Q16979650',
  GOD: 'Q178885',
  DEITY: 'Q178885',
}

/**
 * Check if an entity's instanceOf array includes a given QID.
 * @param {string[]} instanceOf
 * @param {string} qid
 */
function isA(instanceOf, qid) {
  return Array.isArray(instanceOf) && instanceOf.includes(qid)
}

/**
 * Check if the description or label contains a keyword (case-insensitive).
 * @param {object} entity
 * @param {string[]} keywords
 */
function hasKeyword(entity, keywords) {
  const text = `${entity.label ?? ''} ${entity.description ?? ''}`.toLowerCase()
  return keywords.some((kw) => text.includes(kw.toLowerCase()))
}

/**
 * Check if the wikiCategory contains a segment.
 * @param {object} entity
 * @param {string} segment
 */
function inCategory(entity, segment) {
  return (entity.wikiCategory ?? '').includes(segment)
}

/** Subcategory assignment rules per domain. */
const SUBCATEGORY_RULES = {
  history: [
    {
      subcategoryId: 'world_wars',
      priority: 100,
      match: (e) =>
        hasKeyword(e, ['world war', 'wwi', 'wwii', 'nazi', 'holocaust', 'allied', 'axis powers', 'western front', 'eastern front', 'normandy']),
    },
    {
      subcategoryId: 'battles_military',
      priority: 90,
      match: (e) =>
        isA(e.instanceOf, Q.BATTLE) ||
        isA(e.instanceOf, Q.WAR) ||
        isA(e.instanceOf, Q.CONFLICT) ||
        hasKeyword(e, ['battle of', 'siege of', 'military campaign', 'war of ']),
    },
    {
      subcategoryId: 'ancient_classical',
      priority: 80,
      match: (e) =>
        hasKeyword(e, ['ancient', 'roman empire', 'roman republic', 'greek', 'egypt', 'pharaoh', 'mesopotamia', 'babylon', 'persia', 'alexander the great', 'julius caesar', 'byzantine']) ||
        inCategory(e, 'Ancient'),
    },
    {
      subcategoryId: 'medieval',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['medieval', 'middle ages', 'crusade', 'feudal', 'viking', 'magna carta', 'black death', 'mongol', 'ottoman', 'byzantine']) ||
        inCategory(e, 'Medieval'),
    },
    {
      subcategoryId: 'early_modern',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['renaissance', 'reformation', 'exploration', 'colonial', 'colonialism', 'revolution', 'enlightenment', 'industrial revolution', 'empire', 'napoleo']),
    },
    {
      subcategoryId: 'modern_contemporary',
      priority: 60,
      match: (e) =>
        hasKeyword(e, ['cold war', 'soviet', 'nuclear', 'decolonization', 'independence', 'civil rights', 'globaliz', '20th century', '21st century']),
    },
    {
      subcategoryId: 'social_cultural',
      priority: 50,
      match: (e) =>
        hasKeyword(e, ["women's rights", 'civil rights', 'social movement', 'culture', 'religion', 'philosophy', 'art', 'literature', 'migration', 'slavery', 'abolitio']),
    },
    {
      subcategoryId: 'people_leaders',
      priority: 40,
      match: (e) =>
        isA(e.instanceOf, Q.HUMAN) &&
        (isA(e.instanceOf, Q.POLITICIAN) || isA(e.instanceOf, Q.MONARCH) || isA(e.instanceOf, Q.MILITARY_PERSON) ||
          hasKeyword(e, ['king', 'queen', 'emperor', 'president', 'prime minister', 'general', 'leader', 'founder'])),
    },
    // Fallback — any remaining to modern_contemporary
    {
      subcategoryId: 'modern_contemporary',
      priority: 0,
      match: () => true,
    },
  ],

  animals_wildlife: [
    {
      subcategoryId: 'conservation',
      priority: 100,
      match: (e) =>
        (e.properties?.conservationStatus != null &&
          ['Endangered', 'Critically Endangered', 'Vulnerable', 'Near Threatened'].some(
            (s) => (e.properties.conservationStatus ?? '').includes(s)
          )) ||
        hasKeyword(e, ['endangered', 'extinct', 'critically endangered', 'threatened', 'conservation']),
    },
    {
      subcategoryId: 'birds',
      priority: 90,
      match: (e) =>
        isA(e.instanceOf, Q.BIRD) || hasKeyword(e, ['bird', 'eagle', 'hawk', 'owl', 'parrot', 'penguin', 'duck', 'sparrow', 'falcon', 'vulture', 'heron', 'flamingo', 'ostrich', 'avian', 'raptor']),
    },
    {
      subcategoryId: 'marine_life',
      priority: 85,
      match: (e) =>
        isA(e.instanceOf, Q.SHARK) ||
        isA(e.instanceOf, Q.CETACEAN) ||
        isA(e.instanceOf, Q.CEPHALOPOD) ||
        isA(e.instanceOf, Q.CRUSTACEAN) ||
        hasKeyword(e, ['shark', 'whale', 'dolphin', 'fish', 'coral', 'octopus', 'squid', 'crab', 'lobster', 'shrimp', 'seahorse', 'eel', 'ray', 'tuna', 'salmon', 'marine', 'ocean', 'sea', 'aquatic', 'freshwater']),
    },
    {
      subcategoryId: 'reptiles_amphibians',
      priority: 80,
      match: (e) =>
        isA(e.instanceOf, Q.REPTILE) ||
        isA(e.instanceOf, Q.SNAKE) ||
        isA(e.instanceOf, Q.TURTLE) ||
        isA(e.instanceOf, Q.LIZARD) ||
        isA(e.instanceOf, Q.FROG) ||
        isA(e.instanceOf, Q.AMPHIBIAN) ||
        hasKeyword(e, ['snake', 'lizard', 'turtle', 'tortoise', 'crocodile', 'alligator', 'gecko', 'chameleon', 'frog', 'toad', 'salamander', 'reptile', 'amphibian']),
    },
    {
      subcategoryId: 'insects_arachnids',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['insect', 'spider', 'beetle', 'butterfly', 'moth', 'ant', 'bee', 'wasp', 'scorpion', 'tick', 'mosquito', 'fly', 'cricket', 'grasshopper', 'arachnid', 'arthropod']),
    },
    {
      subcategoryId: 'behavior_intelligence',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['behavior', 'intelligence', 'communication', 'migration', 'social', 'tool use', 'memory', 'instinct', 'mating', 'hibernation', 'echolocation']),
    },
    {
      subcategoryId: 'adaptations',
      priority: 65,
      match: (e) =>
        hasKeyword(e, ['venom', 'camouflage', 'record', 'fastest', 'largest', 'smallest', 'strongest', 'longest', 'adaptation', 'extreme', 'bioluminescen']),
    },
    {
      subcategoryId: 'mammals',
      priority: 50,
      match: (e) =>
        isA(e.instanceOf, Q.MAMMAL) ||
        hasKeyword(e, ['mammal', 'lion', 'tiger', 'bear', 'wolf', 'elephant', 'giraffe', 'zebra', 'leopard', 'cheetah', 'gorilla', 'chimpanzee', 'monkey', 'horse', 'deer', 'rabbit', 'bat', 'otter', 'seal', 'walrus']),
    },
    // Fallback
    { subcategoryId: 'mammals', priority: 0, match: () => true },
  ],

  space_astronomy: [
    {
      subcategoryId: 'planets_moons',
      priority: 100,
      match: (e) =>
        isA(e.instanceOf, Q.PLANET) ||
        isA(e.instanceOf, Q.MOON) ||
        isA(e.instanceOf, Q.DWARF_PLANET) ||
        hasKeyword(e, ['planet', 'moon', 'dwarf planet', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'titan', 'ganymede', 'europa', 'asteroid', 'comet', 'solar system']),
    },
    {
      subcategoryId: 'missions_spacecraft',
      priority: 90,
      match: (e) =>
        isA(e.instanceOf, Q.SPACE_MISSION) ||
        isA(e.instanceOf, Q.SPACECRAFT) ||
        hasKeyword(e, ['mission', 'spacecraft', 'probe', 'launch', 'apollo', 'voyager', 'cassini', 'hubble', 'nasa', 'esa', 'rocket', 'soyuz', 'falcon', 'space shuttle']),
    },
    {
      subcategoryId: 'exoplanets_astrobio',
      priority: 85,
      match: (e) =>
        isA(e.instanceOf, Q.EXOPLANET) ||
        hasKeyword(e, ['exoplanet', 'extrasolar', 'habitable zone', 'astrobiology', 'kepler', 'trappist', 'proxima']),
    },
    {
      subcategoryId: 'stars_galaxies',
      priority: 80,
      match: (e) =>
        isA(e.instanceOf, Q.STAR) ||
        isA(e.instanceOf, Q.GALAXY) ||
        isA(e.instanceOf, Q.NEBULA) ||
        isA(e.instanceOf, Q.BLACK_HOLE) ||
        hasKeyword(e, ['star', 'galaxy', 'nebula', 'black hole', 'pulsar', 'quasar', 'supernova', 'milky way', 'andromeda', 'constellation', 'stellar', 'red giant', 'white dwarf', 'neutron star']),
    },
    {
      subcategoryId: 'cosmology_universe',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['big bang', 'dark matter', 'dark energy', 'universe', 'cosmology', 'cosmic', 'expansion', 'inflation', 'multiverse', 'string theory', 'relativity']),
    },
    {
      subcategoryId: 'satellites_tech',
      priority: 60,
      match: (e) =>
        isA(e.instanceOf, Q.SATELLITE) ||
        isA(e.instanceOf, Q.SPACE_TELESCOPE) ||
        isA(e.instanceOf, Q.SPACE_STATION) ||
        isA(e.instanceOf, Q.ASTRONAUT) ||
        hasKeyword(e, ['satellite', 'telescope', 'space station', 'iss', 'astronaut', 'cosmonaut', 'orbit', 'gps']),
    },
    // Fallback
    { subcategoryId: 'cosmology_universe', priority: 0, match: () => true },
  ],

  natural_sciences: [
    {
      subcategoryId: 'chemistry_elements',
      priority: 100,
      match: (e) =>
        isA(e.instanceOf, Q.CHEMICAL_ELEMENT) ||
        isA(e.instanceOf, Q.CHEMICAL_COMPOUND) ||
        inCategory(e, 'Chemistry') ||
        hasKeyword(e, ['element', 'atom', 'molecule', 'compound', 'periodic table', 'reaction', 'acid', 'base', 'oxide', 'carbon', 'hydrogen', 'nitrogen', 'oxygen', 'polymer']),
    },
    {
      subcategoryId: 'physics_mechanics',
      priority: 90,
      match: (e) =>
        inCategory(e, 'Physics') ||
        hasKeyword(e, ['physics', 'force', 'energy', 'gravity', 'quantum', 'relativity', 'thermodynamics', 'electromagnetism', 'wave', 'particle', 'nuclear', 'radiation', 'optics', 'mechanics']),
    },
    {
      subcategoryId: 'geology_earth',
      priority: 85,
      match: (e) =>
        isA(e.instanceOf, Q.MINERAL) ||
        isA(e.instanceOf, Q.VOLCANO) ||
        inCategory(e, 'Earth science') ||
        hasKeyword(e, ['geology', 'rock', 'mineral', 'volcano', 'earthquake', 'tectonic', 'fossil', 'erosion', 'crystal', 'sediment', 'magma', 'lava', 'glacier']),
    },
    {
      subcategoryId: 'materials_engineering',
      priority: 80,
      match: (e) =>
        isA(e.instanceOf, Q.ALLOY) ||
        hasKeyword(e, ['material', 'metal', 'alloy', 'steel', 'glass', 'ceramic', 'plastic', 'textile', 'semiconductor', 'nanotechnology', 'engineering']),
    },
    {
      subcategoryId: 'ecology_environment',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['ecology', 'ecosystem', 'climate', 'environment', 'biome', 'deforestation', 'pollution', 'extinction', 'conservation', 'carbon cycle', 'food web']),
    },
    {
      subcategoryId: 'botany_plants',
      priority: 70,
      match: (e) =>
        isA(e.instanceOf, Q.PLANT) ||
        inCategory(e, 'Biology/Plants') ||
        hasKeyword(e, ['plant', 'tree', 'flower', 'botany', 'seed', 'photosynthesis', 'fungus', 'fungi', 'fern', 'moss', 'algae', 'crop', 'agriculture']),
    },
    {
      subcategoryId: 'biology_organisms',
      priority: 60,
      match: (e) =>
        inCategory(e, 'Biology') ||
        hasKeyword(e, ['biology', 'cell', 'gene', 'dna', 'rna', 'protein', 'evolution', 'species', 'taxonomy', 'microbe', 'bacteria', 'virus', 'organism', 'living']),
    },
    {
      subcategoryId: 'physics_mechanics',
      priority: 0,
      match: () => true,
    },
  ],

  general_knowledge: [
    {
      subcategoryId: 'records_firsts',
      priority: 90,
      match: (e) =>
        hasKeyword(e, ['record', 'first', 'oldest', 'largest', 'tallest', 'smallest', 'longest', 'fastest', 'highest', 'deepest', 'most', 'world record', 'guinness']),
    },
    {
      subcategoryId: 'inventions_tech',
      priority: 85,
      match: (e) =>
        hasKeyword(e, ['invention', 'inventor', 'patent', 'technology', 'computer', 'internet', 'telephone', 'electricity', 'engine', 'device', 'machine', 'programming', 'software', 'hardware']),
    },
    {
      subcategoryId: 'words_language',
      priority: 80,
      match: (e) =>
        hasKeyword(e, ['language', 'word', 'etymology', 'alphabet', 'grammar', 'linguistics', 'dialect', 'idiom', 'writing system']),
    },
    {
      subcategoryId: 'everyday_science',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['science', 'chemistry', 'physics', 'biology', 'psychology', 'how does', 'why does', 'misconception', 'phenomenon']),
    },
    {
      subcategoryId: 'landmarks_wonders',
      priority: 65,
      match: (e) =>
        isA(e.instanceOf, Q.BUILDING) ||
        hasKeyword(e, ['landmark', 'wonder', 'monument', 'pyramid', 'tower', 'bridge', 'dam', 'palace', 'temple', 'statue', 'national park', 'heritage']),
    },
    {
      subcategoryId: 'oddities',
      priority: 40,
      match: (e) =>
        hasKeyword(e, ['strange', 'unusual', 'bizarre', 'paradox', 'counterintuitive', 'surprising', 'curiosity', 'weird', 'odd']),
    },
    {
      subcategoryId: 'pop_culture',
      priority: 30,
      match: (e) =>
        hasKeyword(e, ['film', 'movie', 'music', 'song', 'sport', 'game', 'celebrity', 'television', 'cartoon', 'book', 'novel', 'fictional']),
    },
    // Fallback
    { subcategoryId: 'oddities', priority: 0, match: () => true },
  ],

  mythology_folklore: [
    {
      subcategoryId: 'greek_roman',
      priority: 100,
      match: (e) =>
        hasKeyword(e, ['greek', 'roman', 'olympus', 'zeus', 'jupiter', 'athena', 'minerva', 'apollo', 'artemis', 'poseidon', 'neptune', 'hercules', 'achilles', 'odysseus', 'troy', 'titan', 'olympian']),
    },
    {
      subcategoryId: 'norse_celtic',
      priority: 90,
      match: (e) =>
        hasKeyword(e, ['norse', 'celtic', 'viking', 'odin', 'thor', 'loki', 'asgard', 'valhalla', 'druid', 'arthurian', 'merlin', 'king arthur', 'celtic', 'gaelic', 'rune']),
    },
    {
      subcategoryId: 'eastern_myths',
      priority: 85,
      match: (e) =>
        hasKeyword(e, ['hindu', 'buddhist', 'chinese myth', 'japanese myth', 'shinto', 'vishnu', 'shiva', 'krishna', 'brahma', 'ganesha', 'sun wukong', 'amaterasu', 'izanagi', 'yin yang']),
    },
    {
      subcategoryId: 'creatures_monsters',
      priority: 80,
      match: (e) =>
        isA(e.instanceOf, Q.MYTHICAL_CREATURE) ||
        hasKeyword(e, ['dragon', 'monster', 'demon', 'unicorn', 'griffin', 'hydra', 'chimera', 'kraken', 'werewolf', 'vampire', 'phoenix', 'centaur', 'minotaur', 'cyclops', 'creature']),
    },
    {
      subcategoryId: 'creation_cosmology',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['creation', 'flood myth', 'origin', 'cosmogony', 'afterlife', 'underworld', 'heaven', 'paradise', 'genesis', 'chaos', 'primordial']),
    },
    {
      subcategoryId: 'gods_deities',
      priority: 60,
      match: (e) =>
        isA(e.instanceOf, Q.GOD) ||
        isA(e.instanceOf, Q.DEITY) ||
        hasKeyword(e, ['god', 'goddess', 'deity', 'divine', 'pantheon', 'demigod', 'spirit', 'worship', 'cult', 'oracle', 'prophecy']),
    },
    {
      subcategoryId: 'folk_legends',
      priority: 40,
      match: (e) =>
        hasKeyword(e, ['folk', 'legend', 'fairy tale', 'trickster', 'folklore', 'urban legend', 'regional', 'supernatural', 'ghost', 'witch', 'fable', 'tale']),
    },
    // Fallback
    { subcategoryId: 'folk_legends', priority: 0, match: () => true },
  ],

  human_body_health: [
    {
      subcategoryId: 'brain_neuro',
      priority: 100,
      match: (e) =>
        hasKeyword(e, ['brain', 'neuron', 'neuroscience', 'nervous system', 'cognition', 'memory', 'mental', 'consciousness', 'synapse', 'cortex', 'alzheimer', 'psychology', 'psychiatric']),
    },
    {
      subcategoryId: 'genetics_dna',
      priority: 95,
      match: (e) =>
        hasKeyword(e, ['gene', 'dna', 'rna', 'genome', 'chromosome', 'heredity', 'mutation', 'protein', 'crispr', 'cloning', 'genetics', 'hereditary']),
    },
    {
      subcategoryId: 'immunity_disease',
      priority: 90,
      match: (e) =>
        hasKeyword(e, ['immune', 'virus', 'bacteria', 'disease', 'infection', 'vaccine', 'antibody', 'antigen', 'pathogen', 'pandemic', 'epidemic', 'allergy', 'cancer', 'tumor']),
    },
    {
      subcategoryId: 'cardiovascular',
      priority: 85,
      match: (e) =>
        hasKeyword(e, ['heart', 'blood', 'artery', 'vein', 'circulation', 'cardiac', 'cardiovascular', 'pulse', 'blood pressure', 'stroke', 'aneurysm']),
    },
    {
      subcategoryId: 'digestion_metabolism',
      priority: 80,
      match: (e) =>
        hasKeyword(e, ['digestion', 'stomach', 'intestine', 'liver', 'metabolism', 'enzyme', 'nutrient', 'calorie', 'gut', 'microbiome', 'bowel', 'kidney']),
    },
    {
      subcategoryId: 'senses_perception',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['sense', 'vision', 'hearing', 'taste', 'smell', 'touch', 'pain', 'eye', 'ear', 'nose', 'perception', 'optical illusion']),
    },
    {
      subcategoryId: 'anatomy_organs',
      priority: 60,
      match: (e) =>
        hasKeyword(e, ['anatomy', 'organ', 'bone', 'muscle', 'tissue', 'skin', 'lung', 'spine', 'skeleton', 'cell', 'gland', 'hormone']),
    },
    {
      subcategoryId: 'medical_science',
      priority: 40,
      match: (e) =>
        hasKeyword(e, ['medicine', 'surgery', 'drug', 'therapy', 'treatment', 'diagnosis', 'medical', 'doctor', 'hospital', 'clinical', 'pharmaceutical']),
    },
    // Fallback
    { subcategoryId: 'anatomy_organs', priority: 0, match: () => true },
  ],

  food_cuisine: [
    {
      subcategoryId: 'asian_cuisine',
      priority: 90,
      match: (e) =>
        hasKeyword(e, ['japanese', 'chinese', 'korean', 'vietnamese', 'thai', 'indian', 'sushi', 'ramen', 'dim sum', 'kimchi', 'curry', 'noodle', 'tofu', 'sake', 'miso', 'pho', 'pad thai', 'banh mi']),
    },
    {
      subcategoryId: 'european_cuisine',
      priority: 85,
      match: (e) =>
        hasKeyword(e, ['french', 'italian', 'spanish', 'german', 'british', 'greek', 'portuguese', 'pizza', 'pasta', 'croissant', 'baguette', 'wine', 'cheese', 'tapas', 'paella', 'risotto', 'fondue']),
    },
    {
      subcategoryId: 'world_cuisine',
      priority: 80,
      match: (e) =>
        hasKeyword(e, ['mexican', 'african', 'middle eastern', 'lebanese', 'turkish', 'moroccan', 'peruvian', 'brazilian', 'caribbean', 'latin american', 'taco', 'hummus', 'falafel']),
    },
    {
      subcategoryId: 'fermentation_beverages',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['beer', 'wine', 'coffee', 'tea', 'ferment', 'brew', 'distill', 'spirit', 'whiskey', 'vodka', 'rum', 'gin', 'kombucha', 'kefir', 'pickle', 'sourdough']),
    },
    {
      subcategoryId: 'baking_desserts',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['cake', 'bread', 'pastry', 'cookie', 'chocolate', 'dessert', 'sweet', 'ice cream', 'baking', 'muffin', 'pie', 'tart', 'confection', 'candy']),
    },
    {
      subcategoryId: 'ingredients_spices',
      priority: 65,
      match: (e) =>
        hasKeyword(e, ['spice', 'herb', 'ingredient', 'pepper', 'cinnamon', 'vanilla', 'salt', 'sugar', 'oil', 'vinegar', 'garlic', 'onion', 'wheat', 'rice', 'corn', 'soy']),
    },
    {
      subcategoryId: 'food_science',
      priority: 55,
      match: (e) =>
        hasKeyword(e, ['food science', 'chemistry', 'maillard', 'preserv', 'ferment', 'emulsif', 'pasteuriz', 'nutrition', 'vitamin', 'mineral', 'protein', 'carbohydrate', 'fat']),
    },
    {
      subcategoryId: 'food_history',
      priority: 40,
      match: (e) =>
        hasKeyword(e, ['history', 'origin', 'trade route', 'silk road', 'spice trade', 'traditional', 'ancient', 'cultural', 'cuisine', 'cook']),
    },
    // Fallback
    { subcategoryId: 'food_history', priority: 0, match: () => true },
  ],

  art_architecture: [
    {
      subcategoryId: 'museums_institutions',
      priority: 100,
      match: (e) =>
        isA(e.instanceOf, Q.MUSEUM) ||
        hasKeyword(e, ['museum', 'gallery', 'institution', 'louvre', 'metropolitan', 'guggenheim', 'tate', 'smithsonian', 'uffizi', 'hermitage', 'moma', 'cultural center']),
    },
    {
      subcategoryId: 'historic_buildings',
      priority: 90,
      match: (e) =>
        isA(e.instanceOf, Q.CHURCH) ||
        isA(e.instanceOf, Q.TEMPLE) ||
        isA(e.instanceOf, Q.CASTLE) ||
        isA(e.instanceOf, Q.PALACE) ||
        hasKeyword(e, ['castle', 'palace', 'cathedral', 'temple', 'fortress', 'tower', 'ancient', 'historic', 'heritage site', 'ruins', 'colosseum', 'parthenon', 'taj mahal', 'notre dame', 'abbey']),
    },
    {
      subcategoryId: 'engineering_design',
      priority: 85,
      match: (e) =>
        isA(e.instanceOf, Q.BRIDGE) ||
        hasKeyword(e, ['bridge', 'dam', 'tunnel', 'canal', 'skyscraper', 'infrastructure', 'engineering', 'construction', 'structural', 'aqueduct', 'harbor']),
    },
    {
      subcategoryId: 'painting_visual',
      priority: 80,
      match: (e) =>
        isA(e.instanceOf, Q.PAINTING) ||
        hasKeyword(e, ['painting', 'drawing', 'portrait', 'mural', 'fresco', 'canvas', 'watercolor', 'oil paint', 'illustration', 'printmaking', 'engraving', 'sketch', 'artwork', 'artist']),
    },
    {
      subcategoryId: 'sculpture_decorative',
      priority: 75,
      match: (e) =>
        isA(e.instanceOf, Q.SCULPTURE) ||
        hasKeyword(e, ['sculpture', 'statue', 'relief', 'pottery', 'mosaic', 'tapestry', 'textile', 'craft', 'jewelry', 'decorative', 'ceramic']),
    },
    {
      subcategoryId: 'modern_contemporary',
      priority: 70,
      match: (e) =>
        hasKeyword(e, ['modern art', 'contemporary art', 'abstract', 'installation', 'performance art', 'digital art', 'conceptual', 'surrealism', 'dada', 'pop art', '20th century art', '21st century art']),
    },
    {
      subcategoryId: 'architectural_styles',
      priority: 60,
      match: (e) =>
        hasKeyword(e, ['architecture', 'gothic', 'baroque', 'art deco', 'brutalism', 'modernism', 'roman', 'classical', 'bauhaus', 'renaissance architecture', 'style']),
    },
    // Fallback
    { subcategoryId: 'painting_visual', priority: 0, match: () => true },
  ],

  geography: [
    {
      subcategoryId: 'extreme_records',
      priority: 100,
      match: (e) =>
        hasKeyword(e, ['highest', 'deepest', 'largest', 'smallest', 'longest', 'driest', 'hottest', 'coldest', 'record', 'extreme', 'mount everest', 'mariana trench', 'sahara', 'amazon']),
    },
    {
      subcategoryId: 'africa',
      priority: 90,
      match: (e) =>
        hasKeyword(e, ['africa', 'african', 'sahara', 'nile', 'congo', 'niger', 'victoria', 'kenya', 'ethiopia', 'egypt', 'nigeria', 'south africa', 'tanzania', 'madagascar', 'kalahari']),
    },
    {
      subcategoryId: 'asia_oceania',
      priority: 85,
      match: (e) =>
        hasKeyword(e, ['asia', 'asian', 'oceania', 'australia', 'pacific', 'china', 'india', 'japan', 'himalaya', 'gobi', 'yangtze', 'ganges', 'indus', 'siberia', 'indonesia', 'new zealand']),
    },
    {
      subcategoryId: 'europe',
      priority: 80,
      match: (e) =>
        hasKeyword(e, ['europe', 'european', 'alps', 'danube', 'rhine', 'thames', 'volga', 'mediterranean', 'scandinavia', 'iberia', 'balkans', 'france', 'germany', 'italy', 'spain', 'uk', 'russia']),
    },
    {
      subcategoryId: 'americas',
      priority: 75,
      match: (e) =>
        hasKeyword(e, ['america', 'amazon', 'andes', 'mississippi', 'great lakes', 'patagonia', 'rocky mountains', 'appalachian', 'caribbean', 'canada', 'mexico', 'brazil', 'argentina', 'chile']),
    },
    {
      subcategoryId: 'landforms_water',
      priority: 60,
      match: (e) =>
        isA(e.instanceOf, Q.MOUNTAIN) ||
        isA(e.instanceOf, Q.RIVER) ||
        isA(e.instanceOf, Q.LAKE) ||
        isA(e.instanceOf, Q.ISLAND) ||
        isA(e.instanceOf, Q.CAVE) ||
        isA(e.instanceOf, Q.DESERT) ||
        isA(e.instanceOf, Q.OCEAN) ||
        hasKeyword(e, ['mountain', 'river', 'lake', 'island', 'cave', 'desert', 'ocean', 'sea', 'glacier', 'canyon', 'valley', 'plateau', 'peninsula', 'bay', 'strait', 'reef']),
    },
    {
      subcategoryId: 'climate_biomes',
      priority: 50,
      match: (e) =>
        hasKeyword(e, ['climate', 'biome', 'tropical', 'arctic', 'tundra', 'rainforest', 'savanna', 'monsoon', 'weather', 'temperature', 'humidity', 'permafrost']),
    },
    // Fallback
    { subcategoryId: 'landforms_water', priority: 0, match: () => true },
  ],
}

// ---------------------------------------------------------------------------
// Core selection logic
// ---------------------------------------------------------------------------

/**
 * Assign a subcategory to an entity within a given domain.
 * @param {object} entity
 * @param {string} domain
 * @returns {string} subcategoryId
 */
function assignSubcategory(entity, domain) {
  const rules = SUBCATEGORY_RULES[domain]
  if (!rules) return 'unknown'

  // Sort by priority descending, evaluate each in order
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  for (const rule of sorted) {
    if (rule.priority === 0) continue // skip fallback in first pass
    try {
      if (rule.match(entity)) return rule.subcategoryId
    } catch {
      // rule matching error — skip silently
    }
  }

  // Use fallback rule (priority 0)
  const fallback = sorted.find((r) => r.priority === 0)
  return fallback ? fallback.subcategoryId : 'unknown'
}

/**
 * Select entities for a single domain, respecting subcategory quotas.
 *
 * Algorithm:
 *   1. Collect all entities mapped to this domain
 *   2. Filter: sitelinks >= minSitelinks
 *   3. Assign subcategories
 *   4. For each subcategory, sort by monthlyPageviews DESC and select top-N
 *   5. Fill remaining quota from overflow (highest-pageview unselected entities)
 *   6. Return selected list with subcategory assigned
 *
 * @param {object[]} domainEntities - entities already filtered to this domain
 * @param {string} domain
 * @param {number} target - target total entities
 * @param {number} minSitelinks
 * @returns {{ selected: object[], stats: object }}
 */
function selectDomainEntities(domainEntities, domain, target, minSitelinks) {
  const quotas = QUOTAS[domain]
  if (!quotas) {
    return { selected: [], stats: { domain, total: 0, subcategories: {} } }
  }

  // Step 1: sitelinks filter
  const eligible = domainEntities.filter((e) => (e.sitelinks ?? 0) >= minSitelinks)

  // Step 2: assign subcategories
  const withSubcat = eligible.map((e) => ({
    ...e,
    _subcategory: assignSubcategory(e, domain),
  }))

  // Step 3: group by subcategory
  const groups = {}
  for (const entity of withSubcat) {
    const sub = entity._subcategory
    if (!groups[sub]) groups[sub] = []
    groups[sub].push(entity)
  }

  // Step 4: sort each group by monthlyPageviews DESC
  for (const sub of Object.keys(groups)) {
    groups[sub].sort((a, b) => (b.monthlyPageviews ?? 0) - (a.monthlyPageviews ?? 0))
  }

  // Step 5: compute per-subcategory targets and select
  const selected = []
  const selectedQids = new Set()
  const subcategoryStats = {}

  const quotaEntries = Object.entries(quotas)
  // Normalize quotas in case they don't sum exactly to 1
  const quotaSum = quotaEntries.reduce((s, [, v]) => s + v, 0)

  for (const [sub, quota] of quotaEntries) {
    const subTarget = Math.ceil(target * (quota / quotaSum))
    const pool = groups[sub] ?? []
    const taken = pool.slice(0, subTarget)

    for (const e of taken) {
      if (!selectedQids.has(e.qid)) {
        selectedQids.add(e.qid)
        selected.push(e)
      }
    }

    subcategoryStats[sub] = {
      selected: taken.length,
      available: pool.length,
      target: subTarget,
    }
  }

  // Step 6: fill remaining quota from overflow (any eligible entity not yet selected)
  if (selected.length < target) {
    const overflow = withSubcat
      .filter((e) => !selectedQids.has(e.qid))
      .sort((a, b) => (b.monthlyPageviews ?? 0) - (a.monthlyPageviews ?? 0))

    const needed = target - selected.length
    for (const e of overflow.slice(0, needed)) {
      selectedQids.add(e.qid)
      selected.push(e)
    }
  }

  return {
    selected,
    stats: {
      domain,
      total: selected.length,
      eligible: eligible.length,
      subcategories: subcategoryStats,
    },
  }
}

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

/**
 * Format a single entity for output.
 * @param {object} entity - entity with _subcategory assigned
 * @returns {object}
 */
function formatOutputEntity(entity) {
  return {
    qid: entity.qid,
    label: entity.label ?? entity.title,
    description: entity.description ?? '',
    subcategory: entity._subcategory,
    sitelinks: entity.sitelinks ?? 0,
    monthlyPageviews: entity.monthlyPageviews ?? 0,
    properties: entity.properties ?? {},
    processed: false,
  }
}

/**
 * Print the distribution report for a domain.
 * @param {string} domain
 * @param {object[]} selected
 * @param {object} stats
 * @param {object} quotas
 */
function printDistributionReport(domain, selected, stats, quotas) {
  console.log(`\n=== ${domain} (${stats.total} entities) ===`)

  const quotaEntries = Object.entries(quotas)
  const quotaSum = quotaEntries.reduce((s, [, v]) => s + v, 0)

  for (const [sub, quota] of quotaEntries) {
    const subStats = stats.subcategories[sub] ?? { selected: 0 }
    const actual = selected.filter((e) => e.subcategory === sub).length
    const actualPct = stats.total > 0 ? ((actual / stats.total) * 100).toFixed(1) : '0.0'
    const targetPct = ((quota / quotaSum) * 100).toFixed(0)
    const check = Math.abs(Number(actualPct) - Number(targetPct)) <= 3 ? '✓' : '~'
    const padded = sub.padEnd(30)
    console.log(`  ${padded} ${String(actual).padStart(4)} (${actualPct.padStart(5)}%) [target: ${targetPct}%] ${check}`)
  }

  const unassigned = selected.filter(
    (e) => !Object.keys(quotas).includes(e.subcategory)
  )
  if (unassigned.length > 0) {
    console.log(`  ${'(other subcategories)'.padEnd(30)} ${String(unassigned.length).padStart(4)}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, {
    input: 'data/raw/vital-articles-l4.json',
    domain: null,
    target: 600,
    'min-sitelinks': 20,
  })

  const inputPath = path.resolve(REPO_ROOT, args.input)
  const targetEntities = Number(args.target) || 600
  const minSitelinks = Number(args['min-sitelinks']) || 20
  const filterDomain = args.domain ?? null

  console.log(`[select-entities] Reading: ${inputPath}`)
  const allEntities = await readJson(inputPath)
  console.log(`[select-entities] Loaded ${allEntities.length} total entities`)
  console.log(`[select-entities] Config: target=${targetEntities}, min-sitelinks=${minSitelinks}${filterDomain ? `, domain=${filterDomain}` : ''}`)

  // ---------------------------------------------------------------------------
  // Step 1: Map all entities to domains
  // ---------------------------------------------------------------------------

  const domainBuckets = {}       // domain → entity[]
  const unmappedEntities = []    // entities that couldn't be classified
  const seenCategories = new Map() // category → domain (for logging)

  for (const entity of allEntities) {
    const domain = mapToDomain(entity.wikiCategory, entity)

    if (domain === null) {
      unmappedEntities.push(entity)
    } else {
      if (!domainBuckets[domain]) domainBuckets[domain] = []
      domainBuckets[domain].push(entity)
      seenCategories.set(entity.wikiCategory, domain)
    }
  }

  // Log unmapped categories summary
  if (unmappedEntities.length > 0) {
    const unmappedCategories = {}
    for (const e of unmappedEntities) {
      const cat = e.wikiCategory ?? '(no category)'
      unmappedCategories[cat] = (unmappedCategories[cat] ?? 0) + 1
    }
    console.log(`\n[select-entities] Unmapped entities: ${unmappedEntities.length}`)
    const topUnmapped = Object.entries(unmappedCategories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    for (const [cat, count] of topUnmapped) {
      console.log(`  ${count.toString().padStart(5)}  ${cat}`)
    }
    if (Object.keys(unmappedCategories).length > 10) {
      console.log(`  ... and ${Object.keys(unmappedCategories).length - 10} more categories`)
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Log domain size summary
  // ---------------------------------------------------------------------------

  const domainsToProcess = filterDomain
    ? [filterDomain]
    : Object.keys(QUOTAS)

  console.log('\n[select-entities] Domain bucket sizes (before filtering):')
  for (const domain of domainsToProcess) {
    const count = (domainBuckets[domain] ?? []).length
    console.log(`  ${domain.padEnd(25)} ${count.toString().padStart(5)} entities`)
  }

  // ---------------------------------------------------------------------------
  // Step 3: Select entities per domain and write output
  // ---------------------------------------------------------------------------

  const globalStats = []
  const allSubcategoryUnassigned = []

  for (const domain of domainsToProcess) {
    const domainEntities = domainBuckets[domain] ?? []

    if (domainEntities.length === 0) {
      console.warn(`\n[select-entities] WARNING: No entities found for domain "${domain}"`)
      continue
    }

    const { selected, stats } = selectDomainEntities(
      domainEntities,
      domain,
      targetEntities,
      minSitelinks
    )

    // Format output
    const outputEntities = selected.map(formatOutputEntity)

    // Find unassigned subcategories in output (entities with unknown/unlisted subcategory)
    const knownSubcats = new Set(Object.keys(QUOTAS[domain] ?? {}))
    const domainUnassigned = outputEntities.filter((e) => !knownSubcats.has(e.subcategory))
    allSubcategoryUnassigned.push(...domainUnassigned.map((e) => ({ ...e, domain })))

    // Write output
    const outputPath = path.resolve(REPO_ROOT, `data/curated/${domain}/entities.json`)
    await writeJson(outputPath, outputEntities)

    console.log(`\n[select-entities] Wrote ${outputEntities.length} entities → ${outputPath}`)

    printDistributionReport(domain, outputEntities, stats, QUOTAS[domain] ?? {})

    globalStats.push({ domain, ...stats })
  }

  // ---------------------------------------------------------------------------
  // Step 4: Global summary
  // ---------------------------------------------------------------------------

  console.log('\n\n[select-entities] ===== GLOBAL SUMMARY =====')
  let totalSelected = 0
  for (const s of globalStats) {
    console.log(`  ${s.domain.padEnd(25)} ${String(s.total).padStart(5)} selected  (${s.eligible} eligible)`)
    totalSelected += s.total
  }
  console.log(`  ${'TOTAL'.padEnd(25)} ${String(totalSelected).padStart(5)} entities`)

  if (allSubcategoryUnassigned.length > 0) {
    console.log(`\n[select-entities] Subcategory-unassigned entities: ${allSubcategoryUnassigned.length}`)
    console.log('  (These were assigned unknown/overflow subcategories)')
    const sample = allSubcategoryUnassigned.slice(0, 5)
    for (const e of sample) {
      console.log(`  [${e.domain}] ${e.label} (${e.subcategory}) — ${e.description?.slice(0, 60)}`)
    }
  }

  console.log('\n[select-entities] Done.')
}

main().catch((err) => {
  console.error('[select-entities] Fatal error:', err)
  process.exit(1)
})
