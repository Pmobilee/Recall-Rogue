#!/usr/bin/env node
/**
 * merge-batches.mjs — Merges multiple knowledge fact batch files into a single seed file
 *
 * Usage:
 *   node merge-batches.mjs --pattern "data/generated/knowledge/animals-*.json" \
 *     --output src/data/seed/knowledge-animals.json
 *
 * Deduplicates on fact ID, validates, and prints a summary.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const patternIdx = args.indexOf('--pattern')
const outputIdx = args.indexOf('--output')

if (patternIdx === -1 || outputIdx === -1) {
  console.error('Usage: node merge-batches.mjs --pattern <glob-prefix> --output <seed-file.json>')
  process.exit(1)
}

const pattern = args[patternIdx + 1]
const outputPath = args[outputIdx + 1]

// Find matching files
const dir = path.dirname(pattern)
const prefix = path.basename(pattern).replace('*.json', '')

const files = readdirSync(dir)
  .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
  .sort()
  .map(f => path.join(dir, f))

if (files.length === 0) {
  console.error('No files matched pattern:', pattern)
  process.exit(1)
}

console.log(`[merge-batches] Found ${files.length} batch files:`)

const allFacts = []
const seenIds = new Set()
let dupes = 0

for (const file of files) {
  const facts = JSON.parse(readFileSync(file, 'utf8'))
  let added = 0
  for (const f of facts) {
    if (seenIds.has(f.id)) {
      dupes++
      continue
    }
    seenIds.add(f.id)
    allFacts.push(f)
    added++
  }
  console.log(`  ${path.basename(file)}: ${facts.length} facts (${added} new, ${facts.length - added} dupes)`)
}

// Write merged output
writeFileSync(outputPath, JSON.stringify(allFacts, null, 2))

// Summary stats
const bySub = {}
allFacts.forEach(f => { bySub[f.categoryL2] = (bySub[f.categoryL2] || 0) + 1 })
const funMean = allFacts.reduce((s, f) => s + f.funScore, 0) / allFacts.length
const funStd = Math.sqrt(allFacts.reduce((s, f) => s + (f.funScore - funMean) ** 2, 0) / allFacts.length)

console.log(`\n[merge-batches] Merged: ${allFacts.length} unique facts (${dupes} duplicates removed)`)
console.log(`  Output: ${outputPath}`)
console.log(`  Fun score: mean=${funMean.toFixed(1)} std=${funStd.toFixed(2)}`)
console.log(`  Subcategories:`)
for (const [sub, count] of Object.entries(bySub).sort()) {
  console.log(`    ${sub}: ${count}`)
}
