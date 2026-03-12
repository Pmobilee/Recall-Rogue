#!/usr/bin/env node
/**
 * fix-domains-and-normalize.mjs
 *
 * Fixes domain-level misclassification and normalizes L2 values in seed JSON files.
 * Must be run BEFORE the subcategory keyword backfill.
 *
 * ## What It Does
 * 1. Fixes facts in the WRONG domain:
 *    - Language facts misclassified in General Knowledge → move to "Language"
 *    - Architecture facts misclassified in General Knowledge → move to "Art & Architecture"
 *    - Food & Cuisine → Food & World Cuisine (normalize domain name)
 *    - Empty-domain language facts → assign "Language" based on ID prefix
 *
 * 2. Normalizes L2 values to canonical taxonomy IDs:
 *    - Case-insensitive matching (e.g., "Birds" → "birds")
 *    - Consolidates synonyms (e.g., "mythology" → various myth domains)
 *    - Maps deprecated values (e.g., "Food Definitions" stays for LLM backfill)
 *
 * ## Usage
 *   node scripts/content-pipeline/fix-domains-and-normalize.mjs          # dry run
 *   node scripts/content-pipeline/fix-domains-and-normalize.mjs --write  # apply changes
 *
 * ## Exit codes
 *   0 = success
 *   1 = file I/O error or invalid arguments
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_DIR = path.join(__dirname, '../../src/data/seed')

// ============================================================================
// Configuration
// ============================================================================

/** Language prefixes and their canonical codes */
const LANGUAGE_PREFIXES = {
  'fr': 'french',
  'it': 'italian',
  'es': 'spanish',
  'de': 'german',
  'ko': 'korean',
  'ja': 'japanese',
  'nl': 'dutch',
  'cs': 'czech',
}

/** Keywords that indicate architecture facts */
const ARCHITECTURE_KEYWORDS = [
  'temple', 'church', 'mosque', 'cathedral', 'shrine', 'building',
  'palace', 'structure', 'fortress', 'castle', 'tower', 'cathedral',
  'basilica', 'monument', 'minaret',
]

/** Keywords that indicate language facts (when domain is empty) */
const LANGUAGE_KEYWORDS = [
  'french word', 'italian word', 'german word', 'korean word',
  'japanese', 'dutch word', 'czech word', 'spanish word',
]

/**
 * Mapping of non-canonical L2 values to canonical taxonomy IDs.
 * Keeps items as-is if they need LLM backfill or keyword-based fixes.
 *
 * Format: { non_canonical: canonical }
 */
const L2_NORMALIZE_MAP = {
  // Animals & Wildlife
  'Birds': 'birds',
  'Fish': 'marine_life',
  'Mammals': 'mammals',
  'Insects': 'insects_arachnids',
  'Reptiles': 'reptiles_amphibians',
  'Amphibians': 'reptiles_amphibians',
  'Arachnids': 'insects_arachnids',
  'arthropods': 'insects_arachnids',
  'cnidarians': 'marine_life',
  'fish': 'marine_life', // lowercase variant

  // Natural Sciences - Chemistry
  'Chemistry': 'chemistry_elements',
  'chemical element': 'chemistry_elements',
  'Synthetic Elements': 'chemistry_elements',
  'synthetic element': 'chemistry_elements',
  'Radioactive Elements': 'chemistry_elements',
  'radioactive element': 'chemistry_elements',
  'hypothetical chemical element': 'chemistry_elements',
  'Halogen Elements': 'chemistry_elements',
  'gas': 'chemistry_elements',
  'flammable solid': 'chemistry_elements',
  'active metal': 'chemistry_elements',
  'atmophile element': 'chemistry_elements',
  'combustible powder': 'chemistry_elements',
  'lithophile': 'geology_earth',
  'chalcophile element': 'geology_earth',
  'Chemistry & Materials': 'chemistry_elements',
  'Chemistry & Elements': 'chemistry_elements',
  'Chemistry & Dyes': 'chemistry_elements',
  'Transition Metals': 'chemistry_elements',

  // Natural Sciences - Physics & Materials
  'Physics': 'physics_mechanics',
  'Physical Constants': 'physics_mechanics',
  'Astronomy': 'physics_mechanics',
  'Materials': 'materials_engineering',
  'Materials Science': 'materials_engineering',
  'Theoretical Materials': 'materials_engineering',
  'Techniques': 'materials_engineering',
  'Artistic Techniques & Materials': 'materials_engineering',

  // Natural Sciences - Biology & Geology
  'Biology': 'biology_organisms',
  'geology': 'geology_earth',
  'Geology & Natural Resources': 'geology_earth',
  'Archaeology': 'geology_earth',
  'Biology & Marine Life': 'biology_organisms',

  // Art & Architecture
  'Art': 'painting_visual',
  'museums': 'museums_institutions',
  'buildings': 'historic_buildings',
  'castles': 'historic_buildings',
  'architecture': 'historic_buildings', // generic "architecture" → historic_buildings
  'churchs': 'historic_buildings', // typo: churchs → historic_buildings

  // Mythology & Folklore
  'folklore': 'folk_legends',
  'legends': 'folk_legends',
  'Deities & Beings': 'gods_deities',
  'goddess': 'gods_deities',
  'deity': 'gods_deities',
  'nature deity': 'gods_deities',
  'water deity': 'gods_deities',
  'Loa': 'gods_deities',
  'Ancient Egyptian deity': 'gods_deities',
  'epithet': 'greek_roman',
  'personification': 'greek_roman',
  'Greek deity': 'greek_roman',
  'mythological Greek character': 'greek_roman',
  'greek_myth': 'greek_roman',
  'mythical creature': 'creatures_monsters',
  'sea monster': 'creatures_monsters',
  'dragon': 'creatures_monsters',
  'daemon': 'creatures_monsters',
  'cynocephaly': 'creatures_monsters',
  'artistic theme': 'folk_legends',
  'norse_myth': 'norse_celtic',
  'hindu_myth': 'eastern_myths',
  'egypt_myth': 'eastern_myths',
  'slavic_myth': 'folk_legends',
  'chinese_myth': 'eastern_myths',

  // Space & Astronomy
  'Satellites & Space Probes': 'satellites_tech',
  'satellites': 'satellites_tech',
  'Space Telescopes': 'satellites_tech',
  'Space Infrastructure': 'satellites_tech',
  'Planetary Exploration': 'planets_moons',
  'Lunar Missions': 'missions_spacecraft',
  'Lunar Exploration': 'missions_spacecraft',
  'Chinese Spaceflight': 'missions_spacecraft',
  'Space Probes': 'missions_spacecraft',
  'Research Missions': 'missions_spacecraft',
  'space_missions': 'missions_spacecraft',
  'Spacecraft': 'missions_spacecraft',

  // History
  'Military History': 'battles_military',
  'Military Conflicts': 'battles_military',
  'Ancient Warfare': 'battles_military',
  'Medieval Warfare': 'battles_military',
  'Napoleonic Era': 'early_modern',
  'Medieval Warfare': 'battles_military',
  'Ancient-Medieval': 'ancient_classical',
  'Ancient History': 'ancient_classical',
  'Ancient Rome': 'ancient_classical',
  'Medieval History': 'medieval',
  'Medieval Europe': 'medieval',
  'Crusades': 'medieval',
  '20th-21st Century': 'modern_contemporary',
  '20th Century Conflicts': 'modern_contemporary',
  'Modern Conflicts': 'modern_contemporary',
  '18th-19th Century': 'modern_contemporary',
  'American Civil War': 'modern_contemporary',
  'Franco-Prussian War': 'modern_contemporary',
  'Austro-Prussian War': 'modern_contemporary',
  'Asian Conflicts': 'modern_contemporary',
  'American History': 'modern_contemporary',
  'Colonial Conflicts': 'early_modern',
  'Early American History': 'early_modern',
  '18th Century Europe': 'early_modern',
  'Peninsular War': 'early_modern',
  'Asian History': 'early_modern',
  'World War I': 'world_wars',
  'World War II': 'world_wars',
  'Middle Eastern Conflicts': 'battles_military',
  'Organizations': 'social_cultural',
  'Social Movements': 'social_cultural',
  'Entertainment & Sports': 'social_cultural',
  'Sports': 'social_cultural',
  'Early Modern Wars': 'early_modern',
  'world_history': 'battles_military', // Most world_history facts are battle/military; backfill will re-score with --force

  // Geography
  'territories_dependencies': 'capitals_countries',
  'south_american_capitals': 'americas',
  'central_american_capitals': 'americas',
  'caribbean_territories': 'americas',
  'pacific_islands': 'asia_oceania',
  'major_capitals': 'capitals_countries',
  'islands_regions': 'landforms_water',
  'bodies_of_water': 'landforms_water',
  'african_capitals': 'africa',
  'organizations_unions': 'capitals_countries',
  'countries_capitals': 'capitals_countries',
  'places_regions': 'places_regions', // keep as-is (needs LLM)

  // Food & World Cuisine
  'desserts': 'baking_desserts',
  'grains & starches': 'ingredients_spices',
  'soups': 'world_cuisine',
  'meat & proteins': 'ingredients_spices',
  'ingredients': 'ingredients_spices',
  'breakfast': 'european_cuisine',
  'beverages': 'fermentation_beverages',
  'spices': 'ingredients_spices',

  // Human Body & Health
  'nutrition': 'digestion_metabolism',
  'diseases': 'immunity_disease',

  // Keep as-is (need LLM backfill or keyword-based fixes)
  // 'dishes': 'dishes', // needs LLM to determine cuisine region
  // 'anatomy': 'anatomy', // needs keyword backfill to split
  // 'world_history': 'world_history', // needs backfill to split by era
  // 'Food Definitions': 'Food Definitions', // needs LLM
  // 'Other Animals': 'Other Animals', // needs LLM
  // 'animals': 'animals', // needs LLM
  // 'other': 'other', // needs LLM
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if a string contains any of the keywords (case-insensitive)
 */
function containsAnyKeyword(text, keywords) {
  if (!text) return false
  const lower = text.toLowerCase()
  return keywords.some(kw => lower.includes(kw.toLowerCase()))
}

/**
 * Detect language from ID prefix or statement keywords
 */
function detectLanguageFromIdOrStatement(id, statement) {
  // Try ID prefix first
  const prefix = id.split('-')[0].toLowerCase()
  if (LANGUAGE_PREFIXES[prefix]) {
    return LANGUAGE_PREFIXES[prefix]
  }

  // Try statement keywords
  if (containsAnyKeyword(statement, LANGUAGE_KEYWORDS)) {
    // Try to infer from ID if it has a language indicator
    for (const [prefix, lang] of Object.entries(LANGUAGE_PREFIXES)) {
      if (id.toLowerCase().includes(prefix)) {
        return lang
      }
    }
    // Default to generic 'language' if we can't determine
    return 'language'
  }

  return null
}

/**
 * Check if categoryL2 represents a language (various forms)
 */
function isLanguageCategory(value) {
  if (!value) return false
  const lower = value.toLowerCase()
  return Object.values(LANGUAGE_PREFIXES).some(lang =>
    lower === lang || lower === lang.replace(/_/g, ' '),
  )
}

/**
 * Check if categoryL2 should move to "Art & Architecture"
 */
function isArchitectureInGeneralKnowledge(categoryL2, statement) {
  if (!categoryL2) return false
  const lower = categoryL2.toLowerCase()
  if (lower !== 'architecture') return false
  return containsAnyKeyword(statement, ARCHITECTURE_KEYWORDS)
}

/**
 * Normalize a single L2 value
 */
function normalizeL2(value) {
  if (!value) return value

  // Direct map match
  if (L2_NORMALIZE_MAP[value]) {
    return L2_NORMALIZE_MAP[value]
  }

  // Case-insensitive match
  for (const [key, normalized] of Object.entries(L2_NORMALIZE_MAP)) {
    if (key.toLowerCase() === value.toLowerCase()) {
      return normalized
    }
  }

  // No normalization needed
  return value
}

/**
 * Update both category array and individual fields in sync
 */
function updateCategoryFields(fact, newL1, newL2) {
  fact.categoryL1 = newL1
  fact.categoryL2 = newL2

  // Ensure category array exists
  if (!Array.isArray(fact.category)) {
    fact.category = [newL1, newL2]
  } else {
    // Update indices while preserving array length
    fact.category[0] = newL1
    if (fact.category.length > 1) {
      fact.category[1] = newL2
    } else {
      fact.category.push(newL2)
    }
  }
}

// ============================================================================
// Processing
// ============================================================================

/**
 * Process a single fact, returning { changes, isModified }
 */
function processFact(fact) {
  const changes = []
  let isModified = false
  let newL1 = fact.categoryL1 || ''
  let newL2 = fact.categoryL2 || ''

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Fix domain-level misclassifications
  // ─────────────────────────────────────────────────────────────────────────

  // Language facts in General Knowledge
  if (newL1 === 'General Knowledge' && isLanguageCategory(newL2)) {
    changes.push(`Domain fix: Language in General Knowledge (L2="${newL2}") → Language`)
    newL1 = 'Language'
    isModified = true
  }

  // Architecture facts in General Knowledge
  if (
    newL1 === 'General Knowledge' &&
    isArchitectureInGeneralKnowledge(newL2, fact.statement)
  ) {
    changes.push(
      `Domain fix: Architecture in General Knowledge → Art & Architecture (L2="${newL2}")`,
    )
    newL1 = 'Art & Architecture'
    isModified = true
  }

  // Food & Cuisine → Food & World Cuisine
  if (newL1 === 'Food & Cuisine') {
    changes.push(`Domain fix: Food & Cuisine → Food & World Cuisine`)
    newL1 = 'Food & World Cuisine'
    isModified = true
  }

  // Empty-domain language facts
  if (!newL1 || newL1.trim() === '') {
    const detectedLang = detectLanguageFromIdOrStatement(fact.id, fact.statement)
    if (detectedLang) {
      changes.push(`Domain fix: Empty domain detected as Language (${detectedLang})`)
      newL1 = 'Language'
      newL2 = detectedLang
      isModified = true
    }
  }

  // History facts misclassified in General Knowledge
  if (newL1 === 'General Knowledge' && newL2.toLowerCase() === 'history') {
    changes.push('Domain fix: "history" in General Knowledge → History domain')
    newL1 = 'History'
    newL2 = '' // let backfill classify by era
    isModified = true
  }

  // Geography facts misclassified in General Knowledge
  if (newL1 === 'General Knowledge' && newL2.toLowerCase() === 'geography') {
    changes.push('Domain fix: "geography" in General Knowledge → Geography domain')
    newL1 = 'Geography'
    newL2 = '' // let backfill classify by region
    isModified = true
  }

  // Architecture facts misclassified in General Knowledge (all of them, not just keyword-matched)
  if (newL1 === 'General Knowledge' && newL2.toLowerCase() === 'architecture') {
    changes.push('Domain fix: "architecture" in General Knowledge → Art & Architecture domain')
    newL1 = 'Art & Architecture'
    newL2 = 'historic_buildings'
    isModified = true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Normalize L2 values
  // ─────────────────────────────────────────────────────────────────────────

  const normalizedL2 = normalizeL2(newL2)
  if (normalizedL2 !== newL2) {
    changes.push(`L2 normalization: "${newL2}" → "${normalizedL2}"`)
    newL2 = normalizedL2
    isModified = true
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Apply changes if modified
  // ─────────────────────────────────────────────────────────────────────────

  if (isModified) {
    updateCategoryFields(fact, newL1, newL2)
  }

  return { changes, isModified }
}

/**
 * Process all facts in a JSON file
 */
function processFile(facts) {
  let totalProcessed = 0
  let totalModified = 0
  const stats = {
    domainFixes: 0,
    l2Normalizations: 0,
    byL1: {},
  }

  for (const fact of facts) {
    totalProcessed++
    const { changes, isModified } = processFact(fact)

    if (isModified) {
      totalModified++
      changes.forEach(change => {
        if (change.includes('Domain fix')) {
          stats.domainFixes++
        } else if (change.includes('L2 normalization')) {
          stats.l2Normalizations++
        }
      })

      // Track by L1 domain
      const l1 = fact.categoryL1 || 'unknown'
      stats.byL1[l1] = (stats.byL1[l1] || 0) + 1
    }
  }

  return { totalProcessed, totalModified, stats }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const { values } = parseArgs({
    options: {
      write: { type: 'boolean', default: false },
    },
  })

  const writeMode = values.write
  const mode = writeMode ? 'WRITE' : 'DRY RUN'

  console.log(`[${mode}] Fixing domains and normalizing L2 values in ${SEED_DIR}`)
  console.log('')

  try {
    const files = await fs.readdir(SEED_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort()

    let grandTotalProcessed = 0
    let grandTotalModified = 0
    const grandStats = {
      domainFixes: 0,
      l2Normalizations: 0,
      byFile: {},
    }

    for (const filename of jsonFiles) {
      const filePath = path.join(SEED_DIR, filename)

      try {
        const content = await fs.readFile(filePath, 'utf-8')
        let facts

        try {
          facts = JSON.parse(content)
        } catch (e) {
          console.error(`✗ ${filename}: Invalid JSON`)
          continue
        }

        if (!Array.isArray(facts)) {
          console.error(`✗ ${filename}: Not an array at root`)
          continue
        }

        const { totalProcessed, totalModified, stats } = processFile(facts)
        grandTotalProcessed += totalProcessed
        grandTotalModified += totalModified
        grandStats.domainFixes += stats.domainFixes
        grandStats.l2Normalizations += stats.l2Normalizations
        grandStats.byFile[filename] = {
          processed: totalProcessed,
          modified: totalModified,
          domainFixes: stats.domainFixes,
          l2Normalizations: stats.l2Normalizations,
        }

        if (writeMode && totalModified > 0) {
          const output = JSON.stringify(facts, null, 2)
          await fs.writeFile(filePath, output, 'utf-8')
          console.log(
            `✓ ${filename}: Modified ${totalModified}/${totalProcessed} facts`,
          )
        } else if (totalModified > 0) {
          console.log(
            `○ ${filename}: Would modify ${totalModified}/${totalProcessed} facts`,
          )
        } else {
          console.log(`- ${filename}: ${totalProcessed} facts (no changes)`)
        }
      } catch (e) {
        console.error(`✗ ${filename}: ${e.message}`)
      }
    }

    // Summary
    console.log('')
    console.log('═'.repeat(70))
    console.log('SUMMARY')
    console.log('═'.repeat(70))
    console.log(`Total facts processed:  ${grandTotalProcessed}`)
    console.log(`Total facts modified:   ${grandTotalModified}`)
    console.log(`  - Domain fixes:       ${grandStats.domainFixes}`)
    console.log(`  - L2 normalizations:  ${grandStats.l2Normalizations}`)
    console.log('')

    if (Object.keys(grandStats.byFile).length > 0) {
      console.log('Per-file breakdown:')
      for (const [file, s] of Object.entries(grandStats.byFile)) {
        if (s.modified > 0) {
          console.log(
            `  ${file}: ${s.modified}/${s.processed} (domain: ${s.domainFixes}, L2: ${s.l2Normalizations})`,
          )
        }
      }
    }

    console.log('')
    if (writeMode) {
      console.log('✓ All changes written to disk')
    } else {
      console.log(
        '○ Dry run complete. Run with --write flag to apply changes.',
      )
    }

    process.exit(0)
  } catch (e) {
    console.error(`Fatal error: ${e.message}`)
    process.exit(1)
  }
}

main()
