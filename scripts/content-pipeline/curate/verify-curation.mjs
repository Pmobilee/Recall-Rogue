/**
 * verify-curation.mjs
 *
 * Verifies the quality of curated entity lists per domain.
 * Checks distribution, notability, and data integrity.
 *
 * Usage:
 *   node verify-curation.mjs                          # verify all domains
 *   node verify-curation.mjs --domain animals_wildlife # verify one domain
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, parseCliArgs } from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const CURATED_DIR = path.join(REPO_ROOT, 'data/curated')

// Subcategory quotas — must match what select-entities.mjs uses
const QUOTAS = {
  history: {
    ancient_classical: 0.14,
    medieval: 0.10,
    early_modern: 0.10,
    modern_contemporary: 0.18,
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
  },
  natural_sciences: {
    physics_mechanics: 0.18,
    chemistry_elements: 0.16,
    biology_organisms: 0.14,
    geology_earth: 0.12,
    ecology_environment: 0.10,
    materials_engineering: 0.10,
    botany_plants: 0.10,
  },
  general_knowledge: {
    records_firsts: 0.15,
    inventions_tech: 0.15,
    words_language: 0.12,
    everyday_science: 0.10,
    oddities: 0.15,
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
  },
  art_architecture: {
    painting_visual: 0.18,
    sculpture_decorative: 0.12,
    architectural_styles: 0.15,
    historic_buildings: 0.15,
    modern_contemporary: 0.12,
    museums_institutions: 0.10,
    engineering_design: 0.08,
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

/**
 * Discover all domain directories that have an entities.json file,
 * excluding the vocab/ directory.
 * @returns {Promise<string[]>} sorted list of domain names
 */
async function discoverDomains() {
  const entries = await fs.readdir(CURATED_DIR, { withFileTypes: true })
  const domains = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'vocab') continue

    const entityFile = path.join(CURATED_DIR, entry.name, 'entities.json')
    try {
      await fs.access(entityFile)
      domains.push(entry.name)
    } catch {
      // No entities.json in this directory — skip
    }
  }

  return domains.sort()
}

/**
 * Result severity levels
 */
const SEV = { PASS: 'PASS', WARN: 'WARN', FAIL: 'FAIL' }

/**
 * Merge severity: returns the most severe of two levels.
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
function mergeSev(a, b) {
  if (a === SEV.FAIL || b === SEV.FAIL) return SEV.FAIL
  if (a === SEV.WARN || b === SEV.WARN) return SEV.WARN
  return SEV.PASS
}

/**
 * Format a number as a percentage string with one decimal place.
 * @param {number} value 0–1
 * @returns {string}
 */
function pct(value) {
  return `${(value * 100).toFixed(1)}%`
}

/**
 * Pad a string to a given length with trailing spaces.
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
function padEnd(str, len) {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}

/**
 * Status symbol for a severity level.
 * @param {string} sev
 * @returns {string}
 */
function sym(sev) {
  if (sev === SEV.FAIL) return '✗'
  if (sev === SEV.WARN) return '⚠'
  return '✓'
}

/**
 * Verify a single domain's entities.json.
 * @param {string} domain
 * @param {object[]} allEntitiesByDomain map of domain -> Set of QIDs (for cross-domain check)
 * @returns {{ domain: string, severity: string, errors: number, warnings: number }}
 */
async function verifyDomain(domain, allQidSets) {
  const filePath = path.join(CURATED_DIR, domain, 'entities.json')
  let entities

  try {
    entities = await readJson(filePath)
  } catch (err) {
    console.log(`\n=== ${domain} ===`)
    console.log(`  ERROR: Could not read entities.json — ${err.message}`)
    return { domain, severity: SEV.FAIL, errors: 1, warnings: 0 }
  }

  if (!Array.isArray(entities)) {
    console.log(`\n=== ${domain} ===`)
    console.log('  ERROR: entities.json is not an array')
    return { domain, severity: SEV.FAIL, errors: 1, warnings: 0 }
  }

  const total = entities.length
  let errors = 0
  let warnings = 0
  let domainSev = SEV.PASS

  console.log(`\n=== ${domain} ===`)

  // --- A. Entity count ---
  {
    let sev
    let note
    if (total < 400) {
      sev = SEV.WARN
      note = `⚠ WARN: below minimum 400`
    } else if (total < 500) {
      sev = SEV.PASS
      note = `(target: 500-700, acceptable)`
    } else if (total <= 700) {
      sev = SEV.PASS
      note = `(target: 500-700)`
    } else {
      sev = SEV.PASS
      note = `(above target, OK)`
    }

    if (sev === SEV.WARN) warnings++
    domainSev = mergeSev(domainSev, sev)
    console.log(`Entities: ${total} ${sym(sev)} ${note}`)
  }

  // --- B. Q-ID presence ---
  {
    const missing = entities.filter((e) => e.qid == null || e.qid === '').length
    const sev = missing > 0 ? SEV.FAIL : SEV.PASS
    if (sev === SEV.FAIL) errors++
    domainSev = mergeSev(domainSev, sev)
    if (missing > 0) {
      console.log(`Q-IDs: ${total - missing}/${total} present ${sym(sev)} FAIL: ${missing} missing Q-IDs`)
    } else {
      console.log(`Q-IDs: ${total}/${total} present ${sym(sev)}`)
    }
  }

  // --- C. Sitelinks filter ---
  {
    const below = entities.filter((e) => !e.sitelinks || e.sitelinks <= 20)
    const sev = below.length > 0 ? SEV.FAIL : SEV.PASS
    if (sev === SEV.FAIL) errors++
    domainSev = mergeSev(domainSev, sev)
    if (below.length > 0) {
      console.log(`Sitelinks: ${total - below.length}/${total} > 20 ${sym(sev)} FAIL: ${below.length} below threshold`)
    } else {
      console.log(`Sitelinks: ${total}/${total} > 20 ${sym(sev)}`)
    }
  }

  // --- D. Labels ---
  {
    const missing = entities.filter((e) => !e.label || e.label.trim() === '').length
    const sev = missing > 0 ? SEV.WARN : SEV.PASS
    if (sev === SEV.WARN) warnings++
    domainSev = mergeSev(domainSev, sev)
    if (missing > 0) {
      console.log(`Labels: ${total - missing}/${total} present ${sym(sev)} WARN: ${missing} missing labels`)
    } else {
      console.log(`Labels: ${total}/${total} present ${sym(sev)}`)
    }
  }

  // --- E. Pageview data ---
  {
    const flagged = entities.filter(
      (e) => e.monthlyPageviews == null || e.monthlyPageviews === -1 || e.monthlyPageviews <= 0,
    ).length
    const sev = flagged > 0 ? SEV.WARN : SEV.PASS
    if (sev === SEV.WARN) warnings++
    domainSev = mergeSev(domainSev, sev)
    const valid = total - flagged
    if (flagged > 0) {
      console.log(`Pageviews: ${valid}/${total} valid (${flagged} flagged) ${sym(sev)}`)
    } else {
      console.log(`Pageviews: ${total}/${total} valid ${sym(sev)}`)
    }
  }

  // --- F. Duplicate Q-IDs (within domain) ---
  {
    const qidCounts = new Map()
    for (const e of entities) {
      if (!e.qid) continue
      qidCounts.set(e.qid, (qidCounts.get(e.qid) ?? 0) + 1)
    }
    const dupes = [...qidCounts.entries()].filter(([, count]) => count > 1)
    const sev = dupes.length > 0 ? SEV.FAIL : SEV.PASS
    if (sev === SEV.FAIL) errors++
    domainSev = mergeSev(domainSev, sev)
    if (dupes.length > 0) {
      console.log(`Duplicates: ${dupes.length} duplicate Q-IDs ${sym(sev)} FAIL: ${dupes.map(([q]) => q).slice(0, 5).join(', ')}${dupes.length > 5 ? '…' : ''}`)
    } else {
      console.log(`Duplicates: 0 ${sym(sev)}`)
    }
  }

  // --- G. Subcategory distribution ---
  const quotas = QUOTAS[domain]
  if (quotas) {
    console.log('\nSubcategory Distribution:')

    // Count by subcategory
    const counts = new Map()
    for (const e of entities) {
      const sub = e.subcategory ?? e.subcategoryId ?? null
      if (!sub) continue
      counts.set(sub, (counts.get(sub) ?? 0) + 1)
    }

    const subKeys = Object.keys(quotas)
    const labelWidth = Math.max(...subKeys.map((k) => k.length)) + 1

    for (const subKey of subKeys) {
      const target = quotas[subKey]
      const count = counts.get(subKey) ?? 0
      const actualPct = total > 0 ? count / total : 0
      const low = target - 0.05
      const high = target + 0.05
      const lowPct = Math.max(0, Math.round(low * 100))
      const highPct = Math.round(high * 100)

      let sev
      if (count === 0) {
        sev = SEV.FAIL
        errors++
      } else if (actualPct < low || actualPct > high) {
        sev = SEV.WARN
        warnings++
      } else {
        sev = SEV.PASS
      }

      domainSev = mergeSev(domainSev, sev)

      const label = padEnd(`  ${subKey}:`, labelWidth + 4)
      const countStr = padEnd(`${count}`, 5)
      const actualStr = padEnd(`(${pct(actualPct)})`, 9)
      const targetStr = `[target: ${pct(target)}, range: ${lowPct}-${highPct}%]`

      console.log(`${label} ${countStr} ${actualStr} ${targetStr} ${sym(sev)}`)
    }
  } else {
    console.log(`\n(No quota config for domain "${domain}" — skipping distribution check)`)
  }

  // Store QIDs for cross-domain check
  const qidSet = new Set(entities.filter((e) => e.qid).map((e) => e.qid))
  allQidSets.set(domain, qidSet)

  console.log(`\nResult: ${domainSev} (${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''})`)

  return { domain, severity: domainSev, errors, warnings }
}

/**
 * Check for Q-ID overlap across all verified domains.
 * @param {Map<string, Set<string>>} allQidSets
 */
function reportCrossDomainOverlap(allQidSets) {
  const qidToDomains = new Map()

  for (const [domain, qids] of allQidSets) {
    for (const qid of qids) {
      if (!qidToDomains.has(qid)) {
        qidToDomains.set(qid, [])
      }
      qidToDomains.get(qid).push(domain)
    }
  }

  const overlapping = [...qidToDomains.entries()].filter(([, domains]) => domains.length > 1)
  console.log(
    `Cross-domain Q-ID overlap: ${overlapping.length} ${overlapping.length === 1 ? 'entity' : 'entities'} shared (expected for multidisciplinary figures)`,
  )
}

async function main() {
  const args = parseCliArgs(process.argv, { domain: null })

  let domains
  if (args.domain) {
    domains = [args.domain]
  } else {
    domains = await discoverDomains()
    if (domains.length === 0) {
      console.log(`No domains with entities.json found under ${CURATED_DIR}`)
      process.exit(0)
    }
  }

  /** @type {Map<string, Set<string>>} */
  const allQidSets = new Map()

  /** @type {Array<{ domain: string, severity: string, errors: number, warnings: number }>} */
  const results = []

  for (const domain of domains) {
    const result = await verifyDomain(domain, allQidSets)
    results.push(result)
  }

  // Summary
  console.log('\n=== SUMMARY ===')
  for (const { domain, severity, errors, warnings } of results) {
    const detail = errors + warnings > 0 ? ` (${errors}E ${warnings}W)` : ''
    console.log(`${padEnd(domain + ':', 30)} ${severity}${detail}`)
  }

  if (allQidSets.size > 1) {
    reportCrossDomainOverlap(allQidSets)
  }

  const hasFailure = results.some((r) => r.severity === SEV.FAIL)
  process.exit(hasFailure ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
