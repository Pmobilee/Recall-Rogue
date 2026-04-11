#!/usr/bin/env node
/**
 * check-camp-sprites.mjs
 *
 * Preventative lint: verify that every camp element's tier sprite files exist
 * on disk in a contiguous 0..CAMP_MAX_TIERS[element] sequence.
 *
 * Root cause (2026-04-11 "Camp upgrade sprite gaps"): art pipeline produced
 * non-sequential file numbers for pet, campfire, and journal. getCampUpgradeUrl
 * built URLs directly from logical tier numbers, causing 404s for players at
 * affected tiers. See docs/gotchas.md 2026-04-11 "Camp upgrade sprite gaps:
 * missing tier-N.webp files cause 404s".
 *
 * Fix history: A manifest approach (CAMP_UPGRADE_TIER_FILES in campArtManifest.ts)
 * was initially added to work around the gaps. However the gaps were a
 * PSD-layer-naming misread — the art was always present, just mis-numbered.
 * Sprites were renamed to contiguous numbering via `git mv` and the manifest
 * was removed. getCampUpgradeUrl is now a direct formatter. See docs/gotchas.md
 * 2026-04-11 "Camp sprite 'missing files' was a PSD layer naming misread".
 *
 * Algorithm:
 *   Source of truth: CAMP_MAX_TIERS in src/ui/stores/campState.ts
 *   For each element key:
 *     1. Check public/assets/camp/upgrades/${element}/ directory exists.
 *     2. For tier = 0..CAMP_MAX_TIERS[element], check tier-${tier}.webp exists.
 *        Missing file → ERROR (exit 1).
 *     3. Scan for tier-N.webp where N > CAMP_MAX_TIERS[element] → WARNING (stderr, exit 0).
 *     4. Any .webp not matching tier-\d+\.webp pattern → WARNING (stderr, exit 0).
 *
 * Summary line format:
 *   check-camp-sprites.mjs — scanned N elements, M tier files
 *   ✓ All required tier files exist (contiguous 0..max per element).
 *
 * Exit 0 = no errors (warnings are OK).
 * Exit 1 = one or more errors.
 *
 * Usage:
 *   node scripts/lint/check-camp-sprites.mjs
 *   npm run lint:camp-sprites
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '../../')
const CAMP_STATE_FILE = resolve(ROOT, 'src/ui/stores/campState.ts')
const UPGRADES_DIR = resolve(ROOT, 'public/assets/camp/upgrades')

// ---------------------------------------------------------------------------
// Regex-based parser (zero external deps)
// ---------------------------------------------------------------------------

/**
 * Parse CAMP_MAX_TIERS from campState.ts.
 * Matches the block from the exported const declaration to its closing `}`.
 * Returns Record<string, number>.
 */
function parseMaxTiers(src) {
  const blockMatch = src.match(
    /CAMP_MAX_TIERS\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\n\}/
  )
  if (!blockMatch) {
    throw new Error(`Could not locate CAMP_MAX_TIERS in ${CAMP_STATE_FILE}`)
  }
  const block = blockMatch[1]

  const result = {}
  // Each line like:  tent: 6,  or  campfire: 5,  // comment
  const lineRe = /^\s*(\w+)\s*:\s*(\d+)/gm
  let m
  while ((m = lineRe.exec(block)) !== null) {
    result[m[1]] = parseInt(m[2], 10)
  }
  if (Object.keys(result).length === 0) {
    throw new Error(`CAMP_MAX_TIERS block parsed but found no entries in ${CAMP_STATE_FILE}`)
  }
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let maxTiers
try {
  const campStateSrc = readFileSync(CAMP_STATE_FILE, 'utf8')
  maxTiers = parseMaxTiers(campStateSrc)
} catch (e) {
  console.error(`check-camp-sprites.mjs: PARSE ERROR — ${e.message}`)
  process.exit(1)
}

const errors = []
const warnings = []
let totalFiles = 0

for (const [el, maxTier] of Object.entries(maxTiers)) {
  const elDir = join(UPGRADES_DIR, el)

  // Step 1: directory must exist
  if (!existsSync(elDir)) {
    errors.push(`Missing directory: public/assets/camp/upgrades/${el}/ (CAMP_MAX_TIERS declares element '${el}')`)
    continue
  }

  // Step 2: every tier-0..maxTier must exist on disk
  for (let tier = 0; tier <= maxTier; tier++) {
    const filePath = join(elDir, `tier-${tier}.webp`)
    const relPath = `public/assets/camp/upgrades/${el}/tier-${tier}.webp`
    if (!existsSync(filePath)) {
      errors.push(`Missing file: ${relPath} (required by CAMP_MAX_TIERS[${el}]=${maxTier})`)
    } else {
      totalFiles++
    }
  }

  // Step 3 & 4: scan disk for unexpected files
  let diskFiles
  try {
    diskFiles = readdirSync(elDir)
  } catch {
    diskFiles = []
  }

  for (const fname of diskFiles) {
    if (!fname.endsWith('.webp')) continue
    const tierMatch = fname.match(/^tier-(\d+)\.webp$/)
    if (!tierMatch) {
      // Step 4: webp not matching tier-N.webp pattern
      warnings.push(`Unexpected file: public/assets/camp/upgrades/${el}/${fname} (does not match tier-N.webp pattern)`)
      continue
    }
    const diskTier = parseInt(tierMatch[1], 10)
    if (diskTier > maxTier) {
      // Step 3: orphaned tier beyond CAMP_MAX_TIERS
      warnings.push(`Orphaned file: public/assets/camp/upgrades/${el}/tier-${diskTier}.webp (tier ${diskTier} > CAMP_MAX_TIERS[${el}]=${maxTier})`)
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

console.log(`check-camp-sprites.mjs — scanned ${Object.keys(maxTiers).length} elements, ${totalFiles} tier files`)

if (errors.length === 0) {
  console.log('✓ All required tier files exist (contiguous 0..max per element).')
} else {
  for (const err of errors) {
    console.error(`✗ ERROR: ${err}`)
  }
}

if (warnings.length > 0) {
  process.stderr.write(`⚠ ${warnings.length} warning${warnings.length === 1 ? '' : 's'}:\n`)
  for (const w of warnings) {
    process.stderr.write(`  ${w}\n`)
  }
}

if (errors.length > 0) {
  console.error(`\ncheck-camp-sprites.mjs: FAIL — ${errors.length} error(s). See above.`)
  console.error('Fix: Ensure all tier files 0..CAMP_MAX_TIERS[element] exist on disk, or update')
  console.error('     CAMP_MAX_TIERS in src/ui/stores/campState.ts to match actual file count.')
  console.error('     See docs/gotchas.md 2026-04-11 "Camp upgrade sprite gaps".')
  process.exit(1)
}

process.exit(0)
