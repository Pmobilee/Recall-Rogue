#!/usr/bin/env node
/**
 * audit-asset-metadata.mjs
 *
 * CI audit script: scans all PNG files in a given directory (default: dist/) for
 * metadata chunks (tEXt, iTXt, zTXt, eXIf) and exits non-zero if any are found.
 *
 * Designed to be run as a pre-release gate to prevent shipping PNG files that
 * contain AI-tool attribution, author info, or other embedded metadata to Steam.
 *
 * Usage:
 *   node scripts/audit-asset-metadata.mjs              # Scan dist/
 *   node scripts/audit-asset-metadata.mjs public/      # Scan a specific path
 *   node scripts/audit-asset-metadata.mjs --help
 *
 * Exit codes:
 *   0 — No metadata found in any PNG
 *   1 — Metadata found (or a fatal error occurred)
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

// ─── Constants ────────────────────────────────────────────────────────────────

/** PNG file signature (8 bytes). */
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Chunk types that must NOT appear in production builds. */
const FORBIDDEN_CHUNK_TYPES = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf'])

/** Default directory to audit when none is provided. */
const DEFAULT_SCAN_DIR = 'dist'

// ─── PNG Chunk Scanning ───────────────────────────────────────────────────────

/**
 * Scan a PNG buffer for forbidden metadata chunks.
 *
 * @param {Buffer} buf — full file contents
 * @returns {{ valid: boolean, found: string[] }}
 *   valid: false if the PNG signature is missing or a chunk read overflows.
 *   found: list of forbidden chunk type names present in this file.
 */
function scanPngChunks(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { valid: false, found: [] }
  }

  const found = []
  let offset = 8 // skip PNG signature

  while (offset < buf.length) {
    if (offset + 8 > buf.length) {
      // Truncated chunk header — stop scanning
      break
    }

    const length = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const totalBytes = 4 + 4 + length + 4  // length field + type + data + CRC

    if (offset + totalBytes > buf.length) {
      // Chunk extends beyond file — stop scanning
      break
    }

    if (FORBIDDEN_CHUNK_TYPES.has(type)) {
      found.push(type)
    }

    offset += totalBytes
  }

  return { valid: true, found }
}

// ─── File System Utilities ────────────────────────────────────────────────────

/**
 * Recursively collect all .png file paths under a directory.
 *
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findPngs(dir) {
  const results = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    // Directory does not exist or is unreadable
    throw new Error(`Cannot read directory "${dir}": ${err.message}`)
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...await findPngs(full))
    } else if (entry.name.toLowerCase().endsWith('.png')) {
      results.push(full)
    }
  }
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log([
      'Usage: node scripts/audit-asset-metadata.mjs [path]',
      '',
      'Scans all PNG files under [path] (default: dist/) for forbidden metadata',
      `chunks: ${[...FORBIDDEN_CHUNK_TYPES].join(', ')}`,
      '',
      'Exit codes:',
      '  0 — No metadata found',
      '  1 — Metadata found (or fatal error)',
      '',
      'Run scripts/strip-asset-metadata.mjs to clean metadata from source assets,',
      'then rebuild before re-auditing.',
    ].join('\n'))
    process.exit(0)
  }

  // First non-flag argument is the scan path
  const scanDir = args.find(a => !a.startsWith('--')) ?? DEFAULT_SCAN_DIR

  let pngs
  try {
    pngs = await findPngs(scanDir)
  } catch (err) {
    console.error(`[audit-asset-metadata] ${err.message}`)
    process.exit(1)
  }

  if (pngs.length === 0) {
    console.log(`[audit-asset-metadata] No PNG files found under "${scanDir}/"`)
    process.exit(0)
  }

  /** @type {Array<{ file: string, chunks: string[] }>} */
  const offenders = []

  for (const filePath of pngs) {
    let buf
    try {
      buf = await readFile(filePath)
    } catch (err) {
      console.error(`[audit-asset-metadata] Could not read ${filePath}: ${err.message}`)
      process.exit(1)
    }

    const { valid, found } = scanPngChunks(buf)

    if (!valid) {
      // Not a valid PNG — skip silently (may be a partial file or false .png extension)
      continue
    }

    if (found.length > 0) {
      offenders.push({ file: filePath, chunks: found })
    }
  }

  if (offenders.length === 0) {
    console.log(`[audit-asset-metadata] OK — No metadata found in ${pngs.length} PNG files.`)
    process.exit(0)
  }

  // Metadata found — report and fail
  console.error(`[audit-asset-metadata] FAIL — ${offenders.length} PNG file(s) contain forbidden metadata chunks:\n`)

  for (const { file, chunks } of offenders) {
    // Deduplicate chunk type list for display
    const uniqueChunks = [...new Set(chunks)]
    console.error(`  ${file}`)
    console.error(`    chunks: ${uniqueChunks.join(', ')}`)
  }

  console.error(`\nRun the following to strip metadata from source assets and rebuild:`)
  console.error(`  node scripts/strip-asset-metadata.mjs`)
  console.error(`  npm run build`)
  process.exit(1)
}

main().catch((err) => {
  console.error('[audit-asset-metadata] Fatal error:', err)
  process.exit(1)
})
