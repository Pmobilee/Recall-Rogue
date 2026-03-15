#!/usr/bin/env node
/**
 * split-batches.mjs — Splits curated entities into sub-batches for Sonnet fact generation workers.
 *
 * Usage:
 *   node split-batches.mjs --domain animals_wildlife
 *   node split-batches.mjs --domain animals_wildlife --batch-size 20
 *   node split-batches.mjs --domain animals_wildlife --max-batches 5
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { writeJson, readJson, parseCliArgs } from '../fetch/shared-utils.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')

const args = parseCliArgs(process.argv, {
  'batch-size': 25,
  'max-batches': Infinity,
  'output-dir': null,
})

const domain = args['domain']
if (!domain) {
  console.error('Error: --domain is required')
  console.error('Usage: node split-batches.mjs --domain <name> [--batch-size 25] [--max-batches 5]')
  process.exit(1)
}

const batchSize = Math.max(1, Math.floor(args['batch-size']))
const maxBatches = args['max-batches'] === Infinity ? Infinity : Math.max(1, Math.floor(args['max-batches']))
const outputDir = args['output-dir'] ?? path.join(REPO_ROOT, 'data/generated/knowledge/input')

// ── Load entities ─────────────────────────────────────────────────────────────

const entitiesPath = path.join(REPO_ROOT, 'data/curated', domain, 'entities.json')

let allEntities
try {
  allEntities = await readJson(entitiesPath)
} catch {
  console.error(`Error: could not read ${entitiesPath}`)
  console.error('Make sure the domain name is correct and the entities.json file exists.')
  process.exit(1)
}

const unprocessed = allEntities.filter(e => e.processed === false)

if (unprocessed.length === 0) {
  console.log(`[split-batches] No unprocessed entities found in ${domain}.`)
  process.exit(0)
}

console.log(`[split-batches] Domain: ${domain}`)
console.log(`[split-batches] Total entities: ${allEntities.length} | Unprocessed: ${unprocessed.length}`)

// ── Group by subcategory ──────────────────────────────────────────────────────

/** @type {Map<string, object[]>} */
const bySubcategory = new Map()

for (const entity of unprocessed) {
  const sub = entity.subcategory ?? 'unknown'
  if (!bySubcategory.has(sub)) bySubcategory.set(sub, [])
  bySubcategory.get(sub).push(entity)
}

const subcategories = [...bySubcategory.keys()].sort()
console.log(`[split-batches] Subcategories: ${subcategories.join(', ')}`)

// ── Round-robin fill batches ──────────────────────────────────────────────────

// Cursors track which index we're at within each subcategory's list.
// One entity is taken from each subcategory in turn until the batch is full,
// ensuring each batch has diverse subcategory coverage.
const cursors = Object.fromEntries(subcategories.map(s => [s, 0]))
const batches = []

while (true) {
  if (batches.length >= maxBatches) break

  const batch = []
  let anyAdded = true

  while (batch.length < batchSize && anyAdded) {
    anyAdded = false
    for (const sub of subcategories) {
      if (batch.length >= batchSize) break
      const list = bySubcategory.get(sub)
      if (cursors[sub] >= list.length) continue
      batch.push(list[cursors[sub]++])
      anyAdded = true
    }
  }

  if (batch.length === 0) break
  batches.push(batch)
}

const totalBatches = batches.length

// ── Write batch files ─────────────────────────────────────────────────────────

await fs.mkdir(outputDir, { recursive: true })

for (let i = 0; i < batches.length; i++) {
  const batchIndex = i + 1
  const nn = String(batchIndex).padStart(2, '0')
  const filename = `${domain}-batch-${nn}.json`
  const filePath = path.join(outputDir, filename)

  const subCounts = {}
  for (const e of batches[i]) {
    const sub = e.subcategory ?? 'unknown'
    subCounts[sub] = (subCounts[sub] ?? 0) + 1
  }

  const payload = {
    domain,
    batchIndex,
    totalBatches,
    entities: batches[i],
  }

  await writeJson(filePath, payload)

  const coverage = Object.entries(subCounts).map(([s, n]) => `${s}:${n}`).join(', ')
  console.log(`  ${filename}  (${batches[i].length} entities) — ${coverage}`)
}

// ── Summary ───────────────────────────────────────────────────────────────────

const totalWritten = batches.reduce((s, b) => s + b.length, 0)
console.log(`\n[split-batches] Done. ${totalBatches} batch(es) written to ${outputDir}`)
console.log(`  Entities queued: ${totalWritten} / ${unprocessed.length}`)

if (totalWritten < unprocessed.length) {
  console.log(`  Note: ${unprocessed.length - totalWritten} entities excluded (--max-batches limit reached)`)
}
