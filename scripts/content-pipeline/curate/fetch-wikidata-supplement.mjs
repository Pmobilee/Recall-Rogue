/**
 * fetch-wikidata-supplement.mjs
 *
 * Fetches entities from the Wikidata SPARQL endpoint for domains that are
 * thin or empty after the Vital Articles pipeline:
 *   - animals_wildlife
 *   - space_astronomy
 *   - mythology_folklore
 *   - food_cuisine
 *
 * Fetched entities are merged (dedup by Q-ID) with any existing
 * data/curated/{domain}/entities.json and the result is written back out.
 *
 * Usage:
 *   node scripts/content-pipeline/curate/fetch-wikidata-supplement.mjs
 *   node scripts/content-pipeline/curate/fetch-wikidata-supplement.mjs --domain animals_wildlife
 *   node scripts/content-pipeline/curate/fetch-wikidata-supplement.mjs --domain space_astronomy --target 1200
 *   node scripts/content-pipeline/curate/fetch-wikidata-supplement.mjs --min-sitelinks 25
 *
 * CLI options:
 *   --domain <name>          Only fetch for one domain (default: all four domains)
 *   --target <number>        Target entity count per domain (default: 800)
 *   --min-sitelinks <number> Override minimum sitelinks filter for all domains
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJson, readJson, sleep, parseCliArgs } from '../fetch/shared-utils.mjs'
import { fetchWikidataBatched, normalizeBinding } from '../fetch/wikidata-fetch.mjs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const CURATED_DIR = path.join(REPO_ROOT, 'data/curated')

/** Delay between domain-level batched fetches (ms). */
const DOMAIN_DELAY_MS = 3_000

/** Delay between SPARQL pages inside fetchWikidataBatched (ms). */
const PAGE_DELAY_MS = 2_000

/** Number of results per SPARQL page. */
const PAGE_SIZE = 500

/** Maximum pages per query (500 × 10 = 5000 raw results max). */
const MAX_PAGES = 10

// ---------------------------------------------------------------------------
// SPARQL query templates
// Each query MUST contain {{LIMIT}} and {{OFFSET}} placeholders.
// ---------------------------------------------------------------------------

const QUERY_ANIMALS = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?taxonName ?conservationStatusLabel WHERE {
  ?item wdt:P31 wd:Q16521 .
  ?item wdt:P1843 ?commonName .
  FILTER(LANG(?commonName) = "en")
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > {{MIN_SITELINKS}})
  OPTIONAL { ?item wdt:P225 ?taxonName }
  OPTIONAL { ?item wdt:P141 ?conservationStatus . ?conservationStatus rdfs:label ?conservationStatusLabel . FILTER(LANG(?conservationStatusLabel) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT {{LIMIT}}
OFFSET {{OFFSET}}
`.trim()

const QUERY_SPACE = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  VALUES ?class { wd:Q634 wd:Q2537 wd:Q101600 wd:Q523 wd:Q318 wd:Q3863 wd:Q3559 wd:Q44559 wd:Q5522 wd:Q40218 wd:Q752783 wd:Q4169 wd:Q1385072 wd:Q12029 wd:Q1169522 wd:Q3937 wd:Q2247863 }
  ?item wdt:P31 ?class .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > {{MIN_SITELINKS}})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT {{LIMIT}}
OFFSET {{OFFSET}}
`.trim()

const QUERY_MYTHOLOGY = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks WHERE {
  VALUES ?class { wd:Q22989102 wd:Q24334685 wd:Q34726 wd:Q190588 wd:Q132821 wd:Q178885 wd:Q18553449 wd:Q1457276 wd:Q12308941 wd:Q21070568 }
  ?item wdt:P31 ?class .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > {{MIN_SITELINKS}})
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT {{LIMIT}}
OFFSET {{OFFSET}}
`.trim()

const QUERY_FOOD = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?countryOfOriginLabel WHERE {
  VALUES ?class { wd:Q746549 wd:Q40050 wd:Q25403900 wd:Q2095 wd:Q7802 wd:Q185217 wd:Q81799 wd:Q28803 wd:Q1310477 wd:Q170571 }
  ?item wdt:P31 ?class .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks > {{MIN_SITELINKS}})
  OPTIONAL { ?item wdt:P495 ?countryOfOrigin . SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
ORDER BY DESC(?sitelinks)
LIMIT {{LIMIT}}
OFFSET {{OFFSET}}
`.trim()

// ---------------------------------------------------------------------------
// Domain configuration
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DomainConfig
 * @property {string} domain - Output directory name under data/curated/
 * @property {string} query - SPARQL query template
 * @property {number} defaultMinSitelinks - Default minimum sitelinks threshold
 * @property {(row: Record<string,string|null>) => string} subcategory - Assigns subcategory
 * @property {(row: Record<string,string|null>) => Record<string,string>} properties - Extracts extra properties
 */

/** @type {DomainConfig[]} */
const DOMAIN_CONFIGS = [
  {
    domain: 'animals_wildlife',
    query: QUERY_ANIMALS,
    defaultMinSitelinks: 20,
    subcategory: assignAnimalSubcategory,
    properties: extractAnimalProperties,
  },
  {
    domain: 'space_astronomy',
    query: QUERY_SPACE,
    defaultMinSitelinks: 15,
    subcategory: assignSpaceSubcategory,
    properties: extractSpaceProperties,
  },
  {
    domain: 'mythology_folklore',
    query: QUERY_MYTHOLOGY,
    defaultMinSitelinks: 15,
    subcategory: assignMythologySubcategory,
    properties: extractMythologyProperties,
  },
  {
    domain: 'food_cuisine',
    query: QUERY_FOOD,
    defaultMinSitelinks: 10,
    subcategory: assignFoodSubcategory,
    properties: extractFoodProperties,
  },
]

// ---------------------------------------------------------------------------
// Subcategory assignment — animals_wildlife
// ---------------------------------------------------------------------------

/** Q-IDs for major taxonomic classes (as full Wikidata URIs stripped to IDs). */
const ANIMAL_CLASS_QIDS = new Set([
  'Q7377',   // mammal
  'Q5113',   // bird
  'Q152',    // fish
  'Q11946',  // aquatic animal
  'Q10811',  // reptile
  'Q10908',  // amphibian
  'Q1390',   // insect
  'Q4198907', // arachnid
])

const CONSERVATION_THREATENED_QIDS = new Set([
  'Q278113',   // vulnerable
  'Q11394',    // endangered
  'Q219127',   // critically endangered
  'Q239509',   // extinct in the wild
])

/**
 * Assigns a subcategory for an animal entity using conservationStatus Q-ID
 * and description keyword heuristics.
 *
 * @param {Record<string, string|null>} row
 * @returns {string}
 */
function assignAnimalSubcategory(row) {
  const desc = (row.itemDescription ?? '').toLowerCase()
  const label = (row.itemLabel ?? '').toLowerCase()
  const conservationQid = qidFromUri(row.conservationStatus)

  // Threatened/endangered → conservation subcategory
  if (conservationQid && CONSERVATION_THREATENED_QIDS.has(conservationQid)) {
    return 'conservation'
  }

  // Description/label keyword heuristics
  if (/\b(shark|whale|dolphin|seal|otter|octopus|squid|fish|salmon|tuna|reef|coral|sea\s|ocean|aquatic|marine)\b/.test(desc + ' ' + label)) {
    return 'marine_life'
  }
  if (/\b(snake|lizard|gecko|iguana|crocodile|alligator|tortoise|turtle|reptile|frog|toad|salamander|amphibian)\b/.test(desc + ' ' + label)) {
    return 'reptiles_amphibians'
  }
  if (/\b(bee|ant|beetle|butterfly|moth|spider|scorpion|insect|arthropod|bug|fly|mosquito|wasp|grasshopper|dragonfly|arachnid)\b/.test(desc + ' ' + label)) {
    return 'insects_arachnids'
  }
  if (/\b(bird|eagle|hawk|parrot|penguin|owl|robin|finch|sparrow|crow|raven|heron|flamingo|dove|pigeon|vulture|albatross|avian|aves)\b/.test(desc + ' ' + label)) {
    return 'birds'
  }
  if (/\b(mammal|lion|tiger|bear|wolf|fox|deer|elephant|gorilla|chimpanzee|monkey|cat|dog|horse|bison|moose|rabbit|rodent|bat|bovid|primate|carnivore)\b/.test(desc + ' ' + label)) {
    return 'mammals'
  }

  // Taxon name can also hint at birds via "-idae" suffix common in avian families,
  // but that's edge-case. Default fallback covers unusual cases like sponges, worms, etc.
  return 'adaptations'
}

/**
 * Extracts animal-specific properties from a SPARQL row.
 *
 * @param {Record<string, string|null>} row
 * @returns {Record<string, string>}
 */
function extractAnimalProperties(row) {
  /** @type {Record<string, string>} */
  const props = {}
  if (row.taxonName) props.taxonName = row.taxonName
  if (row.conservationStatusLabel) props.conservationStatus = row.conservationStatusLabel
  return props
}

// ---------------------------------------------------------------------------
// Subcategory assignment — space_astronomy
// ---------------------------------------------------------------------------

/**
 * Maps Wikidata type Q-IDs (from the item URI) to space subcategories.
 * We don't have direct instanceOf in the query, so we use description keywords.
 *
 * @param {Record<string, string|null>} row
 * @returns {string}
 */
function assignSpaceSubcategory(row) {
  const desc = (row.itemDescription ?? '').toLowerCase()
  const label = (row.itemLabel ?? '').toLowerCase()
  const combined = desc + ' ' + label

  if (/\b(mission|spacecraft|probe|rover|lander|satellite|telescope|space\s*station|launch|nasa|esa|launch\s*vehicle|rocket)\b/.test(combined)) {
    return 'missions_spacecraft'
  }
  if (/\b(exoplanet|extrasolar|habitable|kepler|trappist|biosignature|astrobiology)\b/.test(combined)) {
    return 'exoplanets_astrobio'
  }
  if (/\b(planet|moon|lunar|natural\s*satellite|dwarf\s*planet|pluto|mercury|venus|mars|jupiter|saturn|uranus|neptune|titan|europa|ganymede|io\b|callisto)\b/.test(combined)) {
    return 'planets_moons'
  }
  if (/\b(star|galaxy|nebula|pulsar|quasar|black\s*hole|supernova|cluster|milky\s*way|andromeda|constellation|stellar|red\s*giant|white\s*dwarf|neutron)\b/.test(combined)) {
    return 'stars_galaxies'
  }
  if (/\b(comet|asteroid|meteoroid|meteor|bolide|impact\s*crater|kuiper|oort|trans-neptunian|minor\s*planet)\b/.test(combined)) {
    return 'cosmology_universe'
  }

  return 'cosmology_universe'
}

/**
 * Extracts space-specific properties (none beyond standard for now).
 *
 * @param {Record<string, string|null>} _row
 * @returns {Record<string, string>}
 */
function extractSpaceProperties(_row) {
  return {}
}

// ---------------------------------------------------------------------------
// Subcategory assignment — mythology_folklore
// ---------------------------------------------------------------------------

/**
 * Assigns subcategory for a mythology/folklore entity.
 *
 * @param {Record<string, string|null>} row
 * @returns {string}
 */
function assignMythologySubcategory(row) {
  const desc = (row.itemDescription ?? '').toLowerCase()
  const label = (row.itemLabel ?? '').toLowerCase()
  const combined = desc + ' ' + label

  if (/\b(greek|roman|olymp|zeus|hera|apollo|athena|poseidon|ares|hermes|aphrodite|hades|perseus|hercules|odyssey|iliad|trojan)\b/.test(combined)) {
    return 'greek_roman'
  }
  if (/\b(norse|celtic|viking|asgard|odin|thor|loki|freya|valhalla|ragnar|druid|gaelic|irish myth|welsh myth|fenrir|yggdrasil)\b/.test(combined)) {
    return 'norse_celtic'
  }
  if (/\b(hindu|buddhis|chinese myth|japanese myth|shinto|vedic|brahma|vishnu|shiva|durga|ganesh|amaterasu|susanoo|ramayana|mahabharata|taoism|confucian|daoist|aztec|mayan|inca)\b/.test(combined)) {
    return 'eastern_myths'
  }
  if (/\b(dragon|monster|beast|creature|giant|cyclops|hydra|gorgon|sphinx|chimera|unicorn|griffin|werewolf|vampire|demon|fairy|elf|dwarf|troll|goblin|legendary\s*creature)\b/.test(combined)) {
    return 'creatures_monsters'
  }
  if (/\b(creation|origin|flood|afterlife|cosmogony|primordial|underworld|heaven|hell|paradise|apocalypse|end\s*of\s*the\s*world)\b/.test(combined)) {
    return 'creation_cosmology'
  }
  if (/\b(god|goddess|deity|divine|pantheon|worship|cult|oracle|temple|sacrifice)\b/.test(combined)) {
    return 'gods_deities'
  }
  if (/\b(folk|legend|fairy\s*tale|fairy tale|fable|folklore|tale|legend|myth|story|narrative|oral\s*tradition|trickster)\b/.test(combined)) {
    return 'folk_legends'
  }

  return 'folk_legends'
}

/**
 * Extracts mythology-specific properties (none beyond standard for now).
 *
 * @param {Record<string, string|null>} _row
 * @returns {Record<string, string>}
 */
function extractMythologyProperties(_row) {
  return {}
}

// ---------------------------------------------------------------------------
// Subcategory assignment — food_cuisine
// ---------------------------------------------------------------------------

/** Maps Wikidata country Q-IDs to cuisine subcategory. */
const COUNTRY_TO_CUISINE = {
  // Asian
  Q17:   'asian_cuisine',  // Japan
  Q148:  'asian_cuisine',  // China
  Q884:  'asian_cuisine',  // South Korea
  Q668:  'asian_cuisine',  // India
  Q869:  'asian_cuisine',  // Thailand
  Q881:  'asian_cuisine',  // Vietnam
  Q928:  'asian_cuisine',  // Philippines
  Q252:  'asian_cuisine',  // Indonesia
  Q833:  'asian_cuisine',  // Malaysia
  Q819:  'asian_cuisine',  // Laos
  Q836:  'asian_cuisine',  // Myanmar
  Q843:  'asian_cuisine',  // Pakistan
  Q953:  'asian_cuisine',  // Sri Lanka
  Q837:  'asian_cuisine',  // Nepal
  // European
  Q142:  'european_cuisine', // France
  Q38:   'european_cuisine', // Italy
  Q29:   'european_cuisine', // Spain
  Q183:  'european_cuisine', // Germany
  Q145:  'european_cuisine', // United Kingdom
  Q31:   'european_cuisine', // Belgium
  Q55:   'european_cuisine', // Netherlands
  Q347:  'european_cuisine', // Liechtenstein
  Q40:   'european_cuisine', // Austria
  Q39:   'european_cuisine', // Switzerland
  Q35:   'european_cuisine', // Denmark
  Q34:   'european_cuisine', // Sweden
  Q33:   'european_cuisine', // Finland
  Q20:   'european_cuisine', // Norway
  Q189:  'european_cuisine', // Iceland
  Q45:   'european_cuisine', // Portugal
  Q236:  'european_cuisine', // Montenegro
  Q218:  'european_cuisine', // Romania
  Q211:  'european_cuisine', // Latvia
  Q37:   'european_cuisine', // Lithuania
  Q191:  'european_cuisine', // Estonia
  Q214:  'european_cuisine', // Slovakia
  Q213:  'european_cuisine', // Czech Republic
  Q36:   'european_cuisine', // Poland
  Q28:   'european_cuisine', // Hungary
  Q224:  'european_cuisine', // Croatia
  Q225:  'european_cuisine', // Bosnia and Herzegovina
  Q403:  'european_cuisine', // Serbia
  Q221:  'european_cuisine', // North Macedonia
  Q229:  'european_cuisine', // Cyprus
  Q41:   'european_cuisine', // Greece
  Q12585:'european_cuisine', // Turkey (culturally bridges)
  // Americas → world_cuisine
  Q30:   'world_cuisine',  // United States
  Q96:   'world_cuisine',  // Mexico
  Q155:  'world_cuisine',  // Brazil
  Q414:  'world_cuisine',  // Argentina
  Q298:  'world_cuisine',  // Chile
  Q733:  'world_cuisine',  // Paraguay
  Q77:   'world_cuisine',  // Uruguay
  Q736:  'world_cuisine',  // Ecuador
  Q691:  'world_cuisine',  // Peru
  Q778:  'world_cuisine',  // Costa Rica
  Q241:  'world_cuisine',  // Cuba
  // Middle East / Africa → world_cuisine
  Q794:  'world_cuisine',  // Iran
  Q801:  'world_cuisine',  // Israel
  Q804:  'world_cuisine',  // Jordan
  Q811:  'world_cuisine',  // Lebanon
  Q858:  'world_cuisine',  // Syria
  Q796:  'world_cuisine',  // Iraq
  Q11725:'world_cuisine',  // Saudi Arabia — no Q constant needed, fall to world_cuisine
  Q79:   'world_cuisine',  // Egypt
  Q1028: 'world_cuisine',  // Morocco
  Q1008: 'world_cuisine',  // Ivory Coast
  Q1048: 'world_cuisine',  // Ethiopia
}

/**
 * Assigns subcategory for a food/cuisine entity.
 *
 * @param {Record<string, string|null>} row
 * @returns {string}
 */
function assignFoodSubcategory(row) {
  const desc = (row.itemDescription ?? '').toLowerCase()
  const label = (row.itemLabel ?? '').toLowerCase()
  const combined = desc + ' ' + label

  // Country-of-origin based classification first
  const coQid = qidFromUri(row.countryOfOrigin)
  if (coQid && COUNTRY_TO_CUISINE[coQid]) {
    const cuisineSubcat = COUNTRY_TO_CUISINE[coQid]

    // Within asian_cuisine, check if it's actually a beverage/fermented
    if (/\b(ferment|beer|wine|sake|soju|tea|coffee|alcohol|spirit|liquor|brew|miso|kimchi|soy\s*sauce|vinegar)\b/.test(combined)) {
      return 'fermentation_beverages'
    }
    // Desserts/baking override
    if (/\b(cake|pastry|bread|cookie|dessert|chocolate|sweet|candy|confection|biscuit|mochi|wagashi|baklava)\b/.test(combined)) {
      return 'baking_desserts'
    }

    return cuisineSubcat
  }

  // No country — use description keywords
  if (/\b(ferment|beer|wine|coffee|tea|alcohol|spirit|liquor|brew|kombucha|sake|kefir|yogurt|miso|kimchi|soy\s*sauce|vinegar|cider)\b/.test(combined)) {
    return 'fermentation_beverages'
  }
  if (/\b(cake|pastry|bread|cookie|dessert|chocolate|sweet|candy|confection|biscuit|croissant|macaron|tart|pie|pudding)\b/.test(combined)) {
    return 'baking_desserts'
  }
  if (/\b(spice|herb|seasoning|pepper|salt|cinnamon|turmeric|cumin|coriander|saffron|cardamom|clove|vanilla|bay\s*leaf)\b/.test(combined)) {
    return 'ingredients_spices'
  }
  if (/\b(cooking|technique|method|process|bak|fry|boil|steam|grill|roast|ferment|cure|smoke|blanch|saute)\b/.test(combined)) {
    return 'food_science'
  }
  if (/\b(history|origin|ancient|traditional|cultural|heritage)\b/.test(combined)) {
    return 'food_history'
  }

  return 'food_history'
}

/**
 * Extracts food-specific properties from a SPARQL row.
 *
 * @param {Record<string, string|null>} row
 * @returns {Record<string, string>}
 */
function extractFoodProperties(row) {
  /** @type {Record<string, string>} */
  const props = {}
  if (row.countryOfOriginLabel) props.countryOfOrigin = row.countryOfOriginLabel
  return props
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Extracts the Q-ID string (e.g. "Q7377") from a full Wikidata URI
 * like "http://www.wikidata.org/entity/Q7377", or returns null.
 *
 * @param {string|null|undefined} uri
 * @returns {string|null}
 */
function qidFromUri(uri) {
  if (!uri) return null
  const match = uri.match(/Q\d+$/)
  return match ? match[0] : null
}

/**
 * Extracts the numeric Q-ID from a full Wikidata entity URI.
 * Returns null if the URI doesn't look like a Wikidata entity URI.
 *
 * @param {string|null|undefined} uri
 * @returns {string|null}
 */
function qidFromItemUri(uri) {
  return qidFromUri(uri)
}

/**
 * Converts a fetched + normalized SPARQL row into the standard entity object
 * used by the curation pipeline.
 *
 * @param {Record<string, string|null>} row
 * @param {DomainConfig} config
 * @returns {object}
 */
function rowToEntity(row, config) {
  const qid = qidFromItemUri(row.item)
  if (!qid) return null

  const sitelinks = row.sitelinks ? parseInt(row.sitelinks, 10) : 0
  const monthlyPageviews = sitelinks * 500

  return {
    qid,
    label: row.itemLabel ?? qid,
    description: row.itemDescription ?? '',
    subcategory: config.subcategory(row),
    sitelinks,
    monthlyPageviews,
    properties: config.properties(row),
    processed: false,
  }
}

// ---------------------------------------------------------------------------
// Merge helpers
// ---------------------------------------------------------------------------

/**
 * Merges newEntities into existing array, deduplicating by qid.
 * Existing entities take precedence (we don't overwrite already-processed data).
 *
 * @param {object[]} existing
 * @param {object[]} incoming
 * @returns {object[]}
 */
function mergeEntities(existing, incoming) {
  const byQid = new Map(existing.map((e) => [e.qid, e]))
  let added = 0

  for (const entity of incoming) {
    if (!byQid.has(entity.qid)) {
      byQid.set(entity.qid, entity)
      added += 1
    }
  }

  if (added > 0) {
    console.log(`  Merged: +${added} new entities (${existing.length} existing → ${byQid.size} total)`)
  } else {
    console.log(`  No new entities to add (${existing.length} existing, all incoming already present)`)
  }

  return Array.from(byQid.values())
}

// ---------------------------------------------------------------------------
// Per-domain fetch
// ---------------------------------------------------------------------------

/**
 * Injects the MIN_SITELINKS placeholder into a query template before
 * passing it to fetchWikidataBatched (which handles LIMIT/OFFSET).
 *
 * @param {string} query
 * @param {number} minSitelinks
 * @returns {string}
 */
function injectMinSitelinks(query, minSitelinks) {
  return query.replaceAll('{{MIN_SITELINKS}}', String(minSitelinks))
}

/**
 * Fetches and processes entities for a single domain.
 *
 * @param {DomainConfig} config
 * @param {object} opts
 * @param {number} opts.target
 * @param {number|null} opts.minSitelinksOverride
 * @returns {Promise<object[]>} Array of entity objects ready for output
 */
async function fetchDomain(config, { target, minSitelinksOverride }) {
  const minSitelinks = minSitelinksOverride ?? config.defaultMinSitelinks
  const populatedQuery = injectMinSitelinks(config.query, minSitelinks)

  console.log(`\n[${config.domain}] Fetching up to ${target} entities (min sitelinks: ${minSitelinks}) ...`)

  const rows = await fetchWikidataBatched({
    query: populatedQuery,
    targetCount: target * 2, // fetch more raw rows to account for filtering/dedup
    pageSize: PAGE_SIZE,
    maxPages: MAX_PAGES,
    pageDelayMs: PAGE_DELAY_MS,
  })

  console.log(`[${config.domain}] Raw rows fetched: ${rows.length}`)

  // Convert rows → entities, filter out nulls (rows with no valid Q-ID)
  const entities = rows
    .map((row) => rowToEntity(row, config))
    .filter(Boolean)

  // Dedup by qid (fetchWikidataBatched already deduplicates by row identity,
  // but UNION queries can produce the same item under different variables)
  const byQid = new Map()
  for (const entity of entities) {
    if (!byQid.has(entity.qid)) {
      byQid.set(entity.qid, entity)
    }
  }

  const deduped = Array.from(byQid.values())

  // Sort descending by sitelinks (best-known entities first)
  deduped.sort((a, b) => b.sitelinks - a.sitelinks)

  console.log(`[${config.domain}] Entities after dedup: ${deduped.length}`)

  return deduped
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, {
    domain: null,
    target: 800,
    'min-sitelinks': null,
  })

  const targetCount = Number(args.target) || 800
  const minSitelinksOverride = args['min-sitelinks'] != null ? Number(args['min-sitelinks']) : null

  // Determine which domains to process
  const configs = args.domain
    ? DOMAIN_CONFIGS.filter((c) => c.domain === args.domain)
    : DOMAIN_CONFIGS

  if (configs.length === 0) {
    console.error(`Unknown domain: "${args.domain}". Valid domains: ${DOMAIN_CONFIGS.map((c) => c.domain).join(', ')}`)
    process.exit(1)
  }

  console.log(`=== fetch-wikidata-supplement.mjs ===`)
  console.log(`Domains: ${configs.map((c) => c.domain).join(', ')}`)
  console.log(`Target per domain: ${targetCount}`)
  if (minSitelinksOverride != null) console.log(`Min sitelinks override: ${minSitelinksOverride}`)

  for (let i = 0; i < configs.length; i += 1) {
    const config = configs[i]

    // Add delay between domains (not before the first one)
    if (i > 0) {
      console.log(`\nWaiting ${DOMAIN_DELAY_MS}ms before next domain ...`)
      await sleep(DOMAIN_DELAY_MS)
    }

    // Fetch new entities from Wikidata
    let incoming
    try {
      incoming = await fetchDomain(config, { target: targetCount, minSitelinksOverride })
    } catch (err) {
      console.error(`[${config.domain}] Fetch failed: ${err.message}`)
      console.error(err)
      continue
    }

    // Load existing entities (may not exist yet for new domains like animals_wildlife or food_cuisine)
    const outputPath = path.join(CURATED_DIR, config.domain, 'entities.json')
    let existing = []
    try {
      existing = await readJson(outputPath)
      console.log(`[${config.domain}] Loaded ${existing.length} existing entities from ${outputPath}`)
    } catch {
      console.log(`[${config.domain}] No existing entities.json found at ${outputPath} — will create new file`)
    }

    // Merge and write
    const merged = mergeEntities(existing, incoming)

    // Sort merged result: processed entities first (to preserve work), then by sitelinks desc
    merged.sort((a, b) => {
      if (a.processed && !b.processed) return -1
      if (!a.processed && b.processed) return 1
      return b.sitelinks - a.sitelinks
    })

    await writeJson(outputPath, merged)
    console.log(`[${config.domain}] Wrote ${merged.length} entities to ${outputPath}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
