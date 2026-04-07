#!/usr/bin/env node
/**
 * strip-asset-metadata.mjs
 *
 * Strips metadata-only PNG chunks (tEXt, iTXt, zTXt, eXIf) from all PNG files
 * in public/assets/ without re-encoding the image data. This is pure binary
 * chunk surgery — pixel data is never touched, so output is identical in every
 * visual sense to the input.
 *
 * Why: AI-generated assets frequently embed "Made with Google AI" IPTC tags and
 * other metadata chunks that inflate file size and expose toolchain information.
 * These must be stripped before shipping to Steam.
 *
 * PNG chunk format (per RFC 2083):
 *   [4 bytes] length      — big-endian uint32, counts data bytes only
 *   [4 bytes] type        — ASCII chunk type (e.g. "tEXt")
 *   [N bytes] data        — chunk payload
 *   [4 bytes] CRC         — CRC32 over type + data
 *
 * Usage:
 *   node scripts/strip-asset-metadata.mjs              # Strip in-place
 *   node scripts/strip-asset-metadata.mjs --dry-run    # Report only, no writes
 *   node scripts/strip-asset-metadata.mjs --verbose    # Show each file processed
 */

import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

// ─── Constants ────────────────────────────────────────────────────────────────

/** PNG file signature (8 bytes). */
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Chunk types to remove. These carry only metadata — no image data. */
const STRIP_CHUNK_TYPES = new Set(['tEXt', 'iTXt', 'zTXt', 'eXIf'])

/** Root directory to scan. */
const SCAN_ROOT = 'public/assets'

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

/**
 * Parse CLI flags from process.argv.
 * @returns {{ dryRun: boolean, verbose: boolean }}
 */
function parseCli(argv) {
  const options = { dryRun: false, verbose: false }
  for (const token of argv.slice(2)) {
    if (token === '--dry-run') options.dryRun = true
    else if (token === '--verbose') options.verbose = true
    else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/strip-asset-metadata.mjs [options]',
        '',
        'Options:',
        '  --dry-run   Report what would be stripped without modifying files.',
        '  --verbose   Show each file as it is processed.',
        '  --help      Show this help message.',
        '',
        `Scans all PNG files under ${SCAN_ROOT}/ and removes these chunk types:`,
        `  ${[...STRIP_CHUNK_TYPES].join(', ')}`,
      ].join('\n'))
      process.exit(0)
    }
  }
  return options
}

// ─── PNG Chunk Parsing ────────────────────────────────────────────────────────

/**
 * Represents a parsed PNG chunk.
 * @typedef {{ type: string, data: Buffer, start: number, totalBytes: number }} PngChunk
 */

/**
 * Parse all chunks from a PNG buffer.
 *
 * @param {Buffer} buf — full file contents
 * @returns {{ valid: boolean, chunks: PngChunk[] }}
 *   valid: false if the PNG signature is missing or a chunk read overflows the buffer.
 */
function parsePngChunks(buf) {
  // Verify PNG signature
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { valid: false, chunks: [] }
  }

  const chunks = []
  let offset = 8 // skip PNG signature

  while (offset < buf.length) {
    if (offset + 8 > buf.length) {
      // Truncated chunk header — bail out safely
      return { valid: false, chunks }
    }

    const length = buf.readUInt32BE(offset)       // 4 bytes: chunk data length
    const type = buf.toString('ascii', offset + 4, offset + 8) // 4 bytes: chunk type
    const totalBytes = 4 + 4 + length + 4         // length field + type + data + CRC

    if (offset + totalBytes > buf.length) {
      // Chunk extends beyond file — bail out safely
      return { valid: false, chunks }
    }

    chunks.push({ type, data: buf.subarray(offset, offset + totalBytes), start: offset, totalBytes })
    offset += totalBytes
  }

  return { valid: true, chunks }
}

/**
 * Rebuild a PNG buffer, omitting chunks whose type appears in STRIP_CHUNK_TYPES.
 *
 * @param {Buffer} originalBuf — original file buffer
 * @param {PngChunk[]} chunks — parsed chunk list
 * @returns {{ newBuf: Buffer, strippedTypes: string[], bytesRemoved: number }}
 */
function rebuildPng(originalBuf, chunks) {
  const strippedTypes = []
  let bytesRemoved = 0
  const kept = []

  for (const chunk of chunks) {
    if (STRIP_CHUNK_TYPES.has(chunk.type)) {
      strippedTypes.push(chunk.type)
      bytesRemoved += chunk.totalBytes
    } else {
      kept.push(chunk.data)
    }
  }

  const newBuf = Buffer.concat([PNG_SIGNATURE, ...kept])
  return { newBuf, strippedTypes, bytesRemoved }
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
  } catch {
    return results
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

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/**
 * Format a byte count as a human-readable string (B / KB / MB).
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const options = parseCli(process.argv)

  if (options.dryRun) {
    console.log('[dry-run] No files will be modified.\n')
  }

  const pngs = await findPngs(SCAN_ROOT)

  if (pngs.length === 0) {
    console.log(`No PNG files found under ${SCAN_ROOT}/`)
    return
  }

  // Per-directory breakdown: dirPath → { scanned, cleaned, bytesRemoved }
  const dirStats = new Map()

  let totalScanned = 0
  let totalCleaned = 0
  let totalBytesRemoved = 0
  let totalErrors = 0

  for (const filePath of pngs) {
    totalScanned++

    // Resolve directory key (one level above the file)
    const relPath = relative(SCAN_ROOT, filePath)
    const dirKey = relPath.includes('/') ? relPath.split('/')[0] : '(root)'

    if (!dirStats.has(dirKey)) {
      dirStats.set(dirKey, { scanned: 0, cleaned: 0, bytesRemoved: 0 })
    }
    const ds = dirStats.get(dirKey)
    ds.scanned++

    if (options.verbose) {
      process.stdout.write(`  scanning: ${filePath} ... `)
    }

    let buf
    try {
      buf = await readFile(filePath)
    } catch (err) {
      totalErrors++
      console.error(`  [error] ${filePath}: could not read — ${err.message}`)
      continue
    }

    const { valid, chunks } = parsePngChunks(buf)

    if (!valid) {
      if (options.verbose) console.log('skipped (invalid PNG)')
      continue
    }

    const { newBuf, strippedTypes, bytesRemoved } = rebuildPng(buf, chunks)

    if (strippedTypes.length === 0) {
      if (options.verbose) console.log('clean')
      continue
    }

    // This file has metadata chunks
    if (options.verbose) {
      console.log(`stripped [${strippedTypes.join(', ')}] — ${formatBytes(bytesRemoved)} removed`)
    }

    if (!options.dryRun) {
      try {
        await writeFile(filePath, newBuf)
      } catch (err) {
        totalErrors++
        console.error(`  [error] ${filePath}: could not write — ${err.message}`)
        continue
      }
    }

    totalCleaned++
    totalBytesRemoved += bytesRemoved
    ds.cleaned++
    ds.bytesRemoved += bytesRemoved
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('')
  console.log(`=== PNG Metadata Strip Summary${options.dryRun ? ' (dry-run)' : ''} ===`)
  console.log(`  Files scanned:   ${totalScanned}`)
  console.log(`  Files cleaned:   ${totalCleaned}`)
  console.log(`  Bytes saved:     ${formatBytes(totalBytesRemoved)}`)
  if (totalErrors > 0) {
    console.log(`  Errors:          ${totalErrors}`)
  }

  if (dirStats.size > 0) {
    console.log('')
    console.log('  Per-directory breakdown (cleaned/scanned):')
    // Sort by most bytes removed
    const sorted = [...dirStats.entries()]
      .filter(([, s]) => s.cleaned > 0)
      .sort(([, a], [, b]) => b.bytesRemoved - a.bytesRemoved)

    if (sorted.length === 0) {
      console.log('    (no metadata found in any directory)')
    } else {
      for (const [dir, s] of sorted) {
        const pct = ((s.cleaned / s.scanned) * 100).toFixed(0)
        console.log(`    ${dir.padEnd(28)} ${s.cleaned}/${s.scanned} files  ${formatBytes(s.bytesRemoved)} removed  (${pct}%)`)
      }
    }
  }

  if (options.dryRun && totalCleaned > 0) {
    console.log(`\n  Re-run without --dry-run to apply these changes.`)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
