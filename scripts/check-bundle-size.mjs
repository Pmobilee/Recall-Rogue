#!/usr/bin/env node
/**
 * Post-build bundle size checker.
 *
 * Reads the dist/ directory, sums JS chunk sizes (gzip-estimated via stat),
 * and fails with exit code 1 if any individual chunk exceeds the threshold
 * or if the total initial JS bundle exceeds the total budget.
 *
 * Run: node scripts/check-bundle-size.mjs
 * Called automatically by: npm run build:check
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const DIST = path.resolve(process.cwd(), 'dist/assets')
const CHUNK_MAX_KB = 500
const INITIAL_BUNDLE_MAX_KB = 400 // gzipped estimate
const CSS_CHUNK_MAX_KB = 140
const INITIAL_CSS_MAX_KB = 50 // gzipped estimate for app shell CSS
const CHUNK_BUDGET_OVERRIDES = [
  // Phaser runtime is intentionally split into its own lazy chunk.
  { pattern: /phaser/i, maxKb: 1400, excludeFromInitial: true },
  // sql.js wasm loader chunk is also lazy and should not block app shell budget.
  { pattern: /sql-wasm/i, maxKb: 120, excludeFromInitial: true },
]

function resolveChunkBudget(fileName) {
  for (const override of CHUNK_BUDGET_OVERRIDES) {
    if (override.pattern.test(fileName)) return override
  }
  return { maxKb: CHUNK_MAX_KB, excludeFromInitial: false }
}

const files = fs.readdirSync(DIST).filter(f => f.endsWith('.js'))
const cssFiles = fs.readdirSync(DIST).filter(f => f.endsWith('.css'))
let totalGzip = 0
let totalCssGzip = 0
let failed = false

for (const file of files) {
  const raw = fs.readFileSync(path.join(DIST, file))
  const gzipped = zlib.gzipSync(raw)
  const kb = Math.round(gzipped.length / 1024)
  const rawKb = Math.round(raw.length / 1024)
  const budget = resolveChunkBudget(file)
  const isInitial = !budget.excludeFromInitial
  if (isInitial) totalGzip += gzipped.length
  const overLimit = rawKb > budget.maxKb
  const marker = overLimit ? ` [OVER LIMIT > ${budget.maxKb}KB]` : ''
  console.log(`  ${file}: ${rawKb} KB raw, ${kb} KB gzip${marker}`)
  if (overLimit) failed = true
}

const totalKb = Math.round(totalGzip / 1024)
console.log(`\nInitial bundle (gzip estimate): ${totalKb} KB (limit: ${INITIAL_BUNDLE_MAX_KB} KB)`)
if (totalKb > INITIAL_BUNDLE_MAX_KB) {
  console.error('FAILED: Initial bundle exceeds budget')
  failed = true
}

console.log('\nCSS chunks:')
for (const file of cssFiles) {
  const raw = fs.readFileSync(path.join(DIST, file))
  const gzipped = zlib.gzipSync(raw)
  const rawKb = Math.round(raw.length / 1024)
  const gzKb = Math.round(gzipped.length / 1024)
  totalCssGzip += gzipped.length
  const overLimit = rawKb > CSS_CHUNK_MAX_KB
  const marker = overLimit ? ` [OVER LIMIT > ${CSS_CHUNK_MAX_KB}KB]` : ''
  console.log(`  ${file}: ${rawKb} KB raw, ${gzKb} KB gzip${marker}`)
  if (overLimit) failed = true
}

const totalCssKb = Math.round(totalCssGzip / 1024)
console.log(`\nInitial CSS (gzip estimate): ${totalCssKb} KB (limit: ${INITIAL_CSS_MAX_KB} KB)`)
if (totalCssKb > INITIAL_CSS_MAX_KB) {
  console.error('FAILED: Initial CSS exceeds budget')
  failed = true
}

if (failed) process.exit(1)
console.log('Bundle size check passed.')
