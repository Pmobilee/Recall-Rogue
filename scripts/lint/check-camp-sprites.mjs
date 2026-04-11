#!/usr/bin/env node
/**
 * check-camp-sprites.mjs
 *
 * Preventative lint script for the 2026-04-11 camp sprite gap incident.
 *
 * Root cause: Several camp element directories had numeric gaps in their tier
 * files (pet/tier-3, campfire/tier-1, journal/tier-3 were never generated).
 * The original getCampUpgradeUrl() built URLs directly from the logical tier
 * number, producing 404s for players at those tiers. Additionally,
 * library/tier-6.webp exists on disk but is not referenced by any manifest
 * entry (orphaned art). See docs/gotchas.md 2026-04-11 "Camp upgrade sprite
 * gaps: missing tier-N.webp files cause 404s".
 *
 * Fix: CAMP_UPGRADE_TIER_FILES in campArtManifest.ts maps logical tier index
 * → actual file number, skipping gaps. This lint script guards against future
 * drift between that manifest and the files that actually live on disk.
 *
 * Checks performed:
 *   1. Every element key appears in BOTH CAMP_UPGRADE_TIER_FILES (manifest)
 *      and CAMP_MAX_TIERS (campState.ts). Missing from either = ERROR.
 *   2. manifest[el].length - 1 === CAMP_MAX_TIERS[el] for each element.
 *      Length mismatch = ERROR.
 *   3. Every file number in the manifest resolves to an existing .webp on disk.
 *      Missing file = ERROR.
 *   4. Any .webp in the upgrades directory whose tier number is NOT in the
 *      manifest = WARNING (stderr), does NOT cause exit 1.
 *
 * Exit 0 = all checks pass (warnings are OK).
 * Exit 1 = one or more errors.
 *
 * Expected clean output (as of 2026-04-11, ui-agent campArtManifest edits):
 *   check-camp-sprites.mjs — scanned 9 elements, 59 tier files
 *   ✓ All manifest entries resolve to existing files.
 *   ⚠ 1 orphaned file (not referenced by manifest):
 *     public/assets/camp/upgrades/library/tier-6.webp
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
const MANIFEST_FILE = resolve(ROOT, 'src/ui/utils/campArtManifest.ts')
const CAMP_STATE_FILE = resolve(ROOT, 'src/ui/stores/campState.ts')
const UPGRADES_DIR = resolve(ROOT, 'public/assets/camp/upgrades')

// ---------------------------------------------------------------------------
// Regex-based parsers (zero external deps)
// ---------------------------------------------------------------------------

/**
 * Parse CAMP_UPGRADE_TIER_FILES from campArtManifest.ts.
 * Matches the block from the exported const declaration to its closing `}`.
 * Returns Record<string, number[]>.
 */
function parseManifest(src) {
  // Match the entire const body: CAMP_UPGRADE_TIER_FILES = { ... }
  const blockMatch = src.match(
    /CAMP_UPGRADE_TIER_FILES\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\n\}/
  )
  if (!blockMatch) {
    throw new Error(`Could not locate CAMP_UPGRADE_TIER_FILES in ${MANIFEST_FILE}`)
  }
  const block = blockMatch[1]

  const result = {}
  // Each line like:  tent:       [0, 1, 2, 3, 4, 5, 6],  // comment
  const lineRe = /^\s*(\w+)\s*:\s*\[([^\]]+)\]/gm
  let m
  while ((m = lineRe.exec(block)) !== null) {
    const key = m[1]
    const nums = m[2].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    result[key] = nums
  }
  return result
}

/**
 * Parse CAMP_MAX_TIERS from campState.ts.
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
  const lineRe = /^\s*(\w+)\s*:\s*(\d+)/gm
  let m
  while ((m = lineRe.exec(block)) !== null) {
    result[m[1]] = parseInt(m[2], 10)
  }
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifestSrc = readFileSync(MANIFEST_FILE, 'utf8')
const campStateSrc = readFileSync(CAMP_STATE_FILE, 'utf8')

let manifest, maxTiers
try {
  manifest = parseManifest(manifestSrc)
} catch (e) {
  console.error(`check-camp-sprites.mjs: PARSE ERROR — ${e.message}`)
  process.exit(1)
}
try {
  maxTiers = parseMaxTiers(campStateSrc)
} catch (e) {
  console.error(`check-camp-sprites.mjs: PARSE ERROR — ${e.message}`)
  process.exit(1)
}

const manifestKeys = new Set(Object.keys(manifest))
const maxTierKeys = new Set(Object.keys(maxTiers))
const allKeys = new Set([...manifestKeys, ...maxTierKeys])

const errors = []
const warnings = []
let totalFiles = 0

for (const el of allKeys) {
  // Check 1: key must exist in both maps
  if (!manifestKeys.has(el)) {
    errors.push(`Element '${el}' is in CAMP_MAX_TIERS but missing from CAMP_UPGRADE_TIER_FILES`)
    continue
  }
  if (!maxTierKeys.has(el)) {
    errors.push(`Element '${el}' is in CAMP_UPGRADE_TIER_FILES but missing from CAMP_MAX_TIERS`)
    continue
  }

  const files = manifest[el]
  const maxTier = maxTiers[el]

  // Check 2: files.length - 1 must equal maxTier
  const derivedMax = files.length - 1
  if (derivedMax !== maxTier) {
    errors.push(
      `Element '${el}': manifest length-1=${derivedMax} but CAMP_MAX_TIERS[${el}]=${maxTier} (mismatch — update one to match the other)`
    )
  }

  // Check 3: every file number must exist on disk
  const elDir = join(UPGRADES_DIR, el)
  for (const n of files) {
    const path = join(elDir, `tier-${n}.webp`)
    const relPath = `public/assets/camp/upgrades/${el}/tier-${n}.webp`
    if (!existsSync(path)) {
      errors.push(`Missing file on disk: ${relPath} (referenced in CAMP_UPGRADE_TIER_FILES[${el}])`)
    } else {
      totalFiles++
    }
  }

  // Check 4: orphaned webp files (WARNING only)
  if (existsSync(elDir)) {
    const diskFiles = readdirSync(elDir)
      .filter(f => f.endsWith('.webp'))
      .map(f => {
        const match = f.match(/^tier-(\d+)\.webp$/)
        return match ? parseInt(match[1], 10) : null
      })
      .filter(n => n !== null)

    const manifestSet = new Set(files)
    for (const diskN of diskFiles) {
      if (!manifestSet.has(diskN)) {
        const orphanPath = `public/assets/camp/upgrades/${el}/tier-${diskN}.webp`
        warnings.push(orphanPath)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

console.log(`check-camp-sprites.mjs — scanned ${allKeys.size} elements, ${totalFiles} tier files`)

if (errors.length === 0) {
  console.log('✓ All manifest entries resolve to existing files.')
} else {
  for (const err of errors) {
    console.error(`✗ ERROR: ${err}`)
  }
}

if (warnings.length > 0) {
  process.stderr.write(`⚠ ${warnings.length} orphaned file${warnings.length === 1 ? '' : 's'} (not referenced by manifest):\n`)
  for (const w of warnings) {
    process.stderr.write(`  ${w}\n`)
  }
}

if (errors.length > 0) {
  console.error(`\ncheck-camp-sprites.mjs: FAIL — ${errors.length} error(s). See above.`)
  console.error('Fix: Update CAMP_UPGRADE_TIER_FILES in src/ui/utils/campArtManifest.ts and/or')
  console.error('     CAMP_MAX_TIERS in src/ui/stores/campState.ts to match disk state.')
  console.error('     See docs/gotchas.md 2026-04-11 "Camp upgrade sprite gaps".')
  process.exit(1)
}

process.exit(0)
