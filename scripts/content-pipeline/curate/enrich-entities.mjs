/**
 * enrich-entities.mjs
 *
 * Enriches Vital Articles entities with structured Wikidata properties,
 * including sitelinks count for notability filtering.
 *
 * Input:  data/raw/vital-articles-l4.json  — array of {title, qid, wikiCategory}
 * Output: same file (or --output path) — entries enriched with Wikidata properties
 *
 * Usage:
 *   node scripts/content-pipeline/curate/enrich-entities.mjs
 *   node scripts/content-pipeline/curate/enrich-entities.mjs --input data/raw/vital-articles-l4.json --output data/raw/vital-articles-l4-enriched.json --force
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  fetchJson,
  writeJson,
  readJson,
  sleep,
  parseCliArgs,
} from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php'
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500
const SAVE_INTERVAL = 500
const LOG_INTERVAL = 500

// ---------------------------------------------------------------------------
// Domain-specific Wikidata property map
// ---------------------------------------------------------------------------
const DOMAIN_PROPERTIES = {
  // Animals
  taxonName: 'P225',          // taxon name
  conservationStatus: 'P141', // IUCN conservation status (Q-ID → label)

  // History
  startDate: 'P580',          // start time
  endDate: 'P582',            // end time
  pointInTime: 'P585',        // point in time
  country: 'P17',             // country

  // Space
  discoverer: 'P61',          // discoverer or inventor
  orbitalPeriod: 'P2146',     // orbital period

  // Art
  creator: 'P170',            // creator
  inception: 'P571',          // inception date
  material: 'P186',           // material used
  collection: 'P195',         // collection (museum)
  genre: 'P136',              // genre
  movement: 'P135',           // movement (art movement)

  // Food
  countryOfOrigin: 'P495',    // country of origin

  // General
  birthDate: 'P569',
  deathDate: 'P570',
  occupation: 'P106',
  fieldOfWork: 'P101',
}

// Build a reverse map: property-id → property-key
const PROP_ID_TO_KEY = Object.fromEntries(
  Object.entries(DOMAIN_PROPERTIES).map(([k, v]) => [v, k])
)

// ---------------------------------------------------------------------------
// Claim extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract the raw value from a Wikidata mainsnak.
 * Returns a string or null.
 */
function extractSnakValue(mainsnak) {
  if (!mainsnak || mainsnak.snaktype !== 'value') return null

  const dv = mainsnak.datavalue
  if (!dv) return null

  switch (dv.type) {
    case 'wikibase-entityid':
      return dv.value.id // e.g. "Q5"
    case 'time':
      return dv.value.time // e.g. "+1969-07-20T00:00:00Z"
    case 'string':
      return dv.value
    case 'quantity':
      return dv.value.amount
    case 'monolingualtext':
      return dv.value.text
    case 'globecoordinate':
      return `${dv.value.latitude},${dv.value.longitude}`
    default:
      return null
  }
}

/**
 * Get the first claim value for a given property from an entity.
 * For entity-id values, attempts to resolve the label from the same batch map.
 */
function getFirstClaimValue(entity, propertyId, labelMap) {
  const claims = entity.claims?.[propertyId]
  if (!claims || claims.length === 0) return undefined

  const raw = extractSnakValue(claims[0].mainsnak)
  if (raw == null) return undefined

  // If it looks like a Q-ID and we have a label map, prefer label
  if (/^Q\d+$/.test(raw) && labelMap) {
    const resolvedLabel = labelMap[raw]
    if (resolvedLabel) return resolvedLabel
  }

  return raw
}

/**
 * Extract instanceOf (P31) as an array of Q-IDs.
 */
function extractInstanceOf(entity) {
  const claims = entity.claims?.P31
  if (!claims || claims.length === 0) return []
  return claims
    .map((c) => extractSnakValue(c.mainsnak))
    .filter((v) => v != null)
}

/**
 * Extract image filename from P18.
 */
function extractImage(entity) {
  const claims = entity.claims?.P18
  if (!claims || claims.length === 0) return undefined
  return extractSnakValue(claims[0].mainsnak) ?? undefined
}

// ---------------------------------------------------------------------------
// Wikidata batch fetch
// ---------------------------------------------------------------------------

/**
 * Fetch a batch of Wikidata entities by Q-ID.
 * Returns the raw `entities` object from the API response.
 */
async function fetchEntityBatch(qids) {
  const url =
    `${WIKIDATA_API}?action=wbgetentities` +
    `&ids=${qids.join('|')}` +
    `&props=labels|descriptions|sitelinks|claims` +
    `&languages=en` +
    `&format=json`

  const data = await fetchJson(url, {
    headers: { 'User-Agent': 'RecallRogue-ContentPipeline/1.0 (educational game content)' },
    retries: 1,
    timeoutMs: 60_000,
  })

  return data.entities ?? {}
}

/**
 * Build a label map { QID -> label } from a batch of entities.
 * Used to resolve entity-id claim values to human-readable labels.
 */
function buildLabelMap(entities) {
  const map = {}
  for (const [qid, entity] of Object.entries(entities)) {
    const label = entity.labels?.en?.value
    if (label) map[qid] = label
  }
  return map
}

/**
 * Enrich a single entry using data from a batch entity response.
 */
function enrichEntry(entry, entities, labelMap) {
  const entity = entities[entry.qid]
  if (!entity || entity.missing === '') {
    return { ...entry, sitelinks: -1 }
  }

  const label = entity.labels?.en?.value
  const description = entity.descriptions?.en?.value
  const sitelinks = Object.keys(entity.sitelinks ?? {}).length
  const instanceOf = extractInstanceOf(entity)
  const image = extractImage(entity)

  // Extract domain-specific properties
  const properties = {}
  for (const [key, propId] of Object.entries(DOMAIN_PROPERTIES)) {
    const val = getFirstClaimValue(entity, propId, labelMap)
    if (val !== undefined) {
      properties[key] = val
    }
  }

  const enriched = {
    title: entry.title,
    qid: entry.qid,
    wikiCategory: entry.wikiCategory,
    ...(label !== undefined && { label }),
    ...(description !== undefined && { description }),
    sitelinks,
    instanceOf,
    ...(image !== undefined && { image }),
    ...(Object.keys(properties).length > 0 && { properties }),
  }

  return enriched
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, {
    input: 'data/raw/vital-articles-l4.json',
    output: null,
    force: false,
  })

  const inputPath = path.resolve(REPO_ROOT, args.input)
  const outputPath = path.resolve(REPO_ROOT, args.output ?? args.input)

  console.log(`[enrich-entities] Reading: ${inputPath}`)
  const entries = await readJson(inputPath)
  console.log(`[enrich-entities] Loaded ${entries.length} entries`)

  // Filter out entries with no QID
  const nullQidCount = entries.filter((e) => !e.qid).length
  if (nullQidCount > 0) {
    console.log(`[enrich-entities] Skipping ${nullQidCount} entries with null QID`)
  }

  // Partition: needs enrichment vs already done
  const toEnrich = []
  const alreadyDone = []

  for (const entry of entries) {
    if (!entry.qid) {
      alreadyDone.push(entry) // no QID — keep as-is
      continue
    }
    if (!args.force && typeof entry.sitelinks === 'number') {
      alreadyDone.push(entry) // already enriched, skip
      continue
    }
    toEnrich.push(entry)
  }

  console.log(
    `[enrich-entities] To enrich: ${toEnrich.length} | Already done: ${alreadyDone.length}${args.force ? ' (--force ignores cached)' : ''}`
  )

  if (toEnrich.length === 0) {
    console.log('[enrich-entities] Nothing to enrich. Done.')
    return
  }

  // Build a mutable result map keyed by QID / title for merging
  // Start with already-done entries in their original order
  const resultMap = new Map()
  for (const entry of entries) {
    resultMap.set(entry.qid ?? entry.title, entry)
  }

  let enrichedCount = 0
  let failedCount = 0
  let lastSaveAt = 0

  // Process in batches
  for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
    const batch = toEnrich.slice(i, i + BATCH_SIZE)
    const qids = batch.map((e) => e.qid)

    let entities = {}
    let batchFailed = false

    try {
      entities = await fetchEntityBatch(qids)
    } catch (err) {
      console.warn(`[enrich-entities] Batch failed (attempt 1): ${err.message}. Retrying…`)
      await sleep(BATCH_DELAY_MS * 2)
      try {
        entities = await fetchEntityBatch(qids)
      } catch (retryErr) {
        console.error(
          `[enrich-entities] Batch retry failed: ${retryErr.message}. ` +
            `Failed QIDs: ${qids.join(', ')}`
        )
        batchFailed = true
      }
    }

    if (batchFailed) {
      // Mark all entries in this batch as failed
      for (const entry of batch) {
        resultMap.set(entry.qid, { ...entry, sitelinks: -1 })
        failedCount++
      }
    } else {
      const labelMap = buildLabelMap(entities)

      for (const entry of batch) {
        const enriched = enrichEntry(entry, entities, labelMap)
        resultMap.set(entry.qid, enriched)

        if (enriched.sitelinks === -1) {
          failedCount++
        } else {
          enrichedCount++
        }
      }
    }

    const totalProcessed = enrichedCount + failedCount
    if (totalProcessed >= lastSaveAt + SAVE_INTERVAL) {
      console.log(
        `[enrich-entities] Progress: ${totalProcessed}/${toEnrich.length} processed ` +
          `(${enrichedCount} enriched, ${failedCount} failed). Saving intermediate…`
      )
      const currentResult = [...entries.map((e) => resultMap.get(e.qid ?? e.title) ?? e)]
      await writeJson(outputPath, currentResult)
      lastSaveAt = totalProcessed
    }

    if (i + BATCH_SIZE < toEnrich.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // Final save: reconstruct in original entry order
  const finalResult = entries.map((e) => resultMap.get(e.qid ?? e.title) ?? e)
  await writeJson(outputPath, finalResult)

  console.log(
    `[enrich-entities] Done. ` +
      `Enriched: ${enrichedCount} | Skipped (already done): ${alreadyDone.filter((e) => e.qid).length} | Failed: ${failedCount}`
  )
  console.log(`[enrich-entities] Output written to: ${outputPath}`)
}

main().catch((err) => {
  console.error('[enrich-entities] Fatal error:', err)
  process.exit(1)
})
