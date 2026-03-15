/**
 * merge-supplements.mjs
 *
 * Merges supplement entity files into the main entity files for thin domains.
 * Deduplicates by `qid` (existing entities take priority) and by `label`
 * (case-insensitive) to avoid near-duplicates.
 *
 * Usage:
 *   node scripts/content-pipeline/curate/merge-supplements.mjs
 *   node scripts/content-pipeline/curate/merge-supplements.mjs --domain food_cuisine
 *
 * After merging, the `-supplement.json` file is deleted.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJson, readJson, parseCliArgs } from '../fetch/shared-utils.mjs'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const CURATED_DIR = path.join(REPO_ROOT, 'data/curated')

const TARGET_DOMAINS = ['space_astronomy', 'mythology_folklore', 'food_cuisine']

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

/**
 * Merges supplement entities into existing entities, deduplicating by qid
 * (existing takes priority) then by label (case-insensitive).
 *
 * @param {object[]} existing
 * @param {object[]} supplement
 * @returns {object[]}
 */
function mergeEntities(existing, supplement) {
  const byQid = new Map(existing.map((e) => [e.qid, e]))
  const seenLabels = new Set(existing.map((e) => (e.label ?? '').toLowerCase()))

  let addedCount = 0
  let skippedQid = 0
  let skippedLabel = 0

  for (const entity of supplement) {
    if (byQid.has(entity.qid)) {
      skippedQid += 1
      continue
    }

    const labelKey = (entity.label ?? '').toLowerCase()
    if (seenLabels.has(labelKey)) {
      skippedLabel += 1
      continue
    }

    byQid.set(entity.qid, entity)
    seenLabels.add(labelKey)
    addedCount += 1
  }

  console.log(`  Added: ${addedCount} | Skipped (dup qid): ${skippedQid} | Skipped (dup label): ${skippedLabel}`)

  return Array.from(byQid.values())
}

// ---------------------------------------------------------------------------
// Per-domain processing
// ---------------------------------------------------------------------------

/**
 * Merges the supplement file for a single domain into its entities.json.
 *
 * @param {string} domain
 * @returns {Promise<number>} Final entity count after merge
 */
async function processDomain(domain) {
  const entitiesPath = path.join(CURATED_DIR, domain, 'entities.json')
  const supplementPath = path.join(CURATED_DIR, domain, 'entities-supplement.json')

  // Load existing entities
  let existing = []
  try {
    existing = await readJson(entitiesPath)
    console.log(`[${domain}] Existing entities: ${existing.length}`)
  } catch {
    console.log(`[${domain}] No entities.json found — starting from empty`)
  }

  // Load supplement (skip domain if no supplement exists)
  let supplement = []
  try {
    supplement = await readJson(supplementPath)
    console.log(`[${domain}] Supplement entities: ${supplement.length}`)
  } catch {
    console.log(`[${domain}] No entities-supplement.json found — nothing to merge`)
    return existing.length
  }

  // Merge
  const merged = mergeEntities(existing, supplement)
  console.log(`[${domain}] Merged total: ${merged.length}`)

  // Write merged result back to entities.json
  await writeJson(entitiesPath, merged)
  console.log(`[${domain}] Wrote ${merged.length} entities to ${entitiesPath}`)

  // Delete supplement file
  await fs.unlink(supplementPath)
  console.log(`[${domain}] Deleted ${supplementPath}`)

  return merged.length
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseCliArgs(process.argv, { domain: null })

  const domains = args.domain ? [args.domain] : TARGET_DOMAINS

  // Validate domain arg if provided
  if (args.domain && !TARGET_DOMAINS.includes(args.domain)) {
    console.error(`Unknown domain: "${args.domain}". Valid domains: ${TARGET_DOMAINS.join(', ')}`)
    process.exit(1)
  }

  console.log('=== merge-supplements.mjs ===')
  console.log(`Domains: ${domains.join(', ')}\n`)

  /** @type {Array<{domain: string, total: number}>} */
  const summary = []

  for (const domain of domains) {
    try {
      const total = await processDomain(domain)
      summary.push({ domain, total })
    } catch (err) {
      console.error(`[${domain}] Error: ${err.message}`)
      console.error(err)
    }
    console.log()
  }

  console.log('=== Summary ===')
  for (const { domain, total } of summary) {
    console.log(`  ${domain}: ${total} entities`)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
