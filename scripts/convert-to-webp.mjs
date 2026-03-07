/**
 * convert-to-webp.mjs
 *
 * Converts all PNG files in public/assets/ and public/cutscene/ to lossless WebP
 * using sharp. Places .webp files alongside the originals (same directory, same name).
 *
 * Skips miner_sheet.png spritesheets — Phaser needs exact pixel dimensions for
 * frame extraction and WebP re-encoding could shift pixels.
 *
 * Usage: node scripts/convert-to-webp.mjs
 */
import { readdir, stat } from 'node:fs/promises'
import { join, parse } from 'node:path'
import { existsSync } from 'node:fs'
import sharp from 'sharp'

/** Filenames to skip (spritesheets that must stay pixel-exact PNG). */
const SKIP_FILENAMES = new Set([
  'miner_sheet.png',
])

/**
 * Recursively find all .png files under a directory.
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
    } else if (entry.name.endsWith('.png')) {
      results.push(full)
    }
  }
  return results
}

async function main() {
  const dirs = ['public/assets', 'public/cutscene']
  let totalPngs = 0
  let converted = 0
  let skipped = 0
  let totalPngBytes = 0
  let totalWebpBytes = 0

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      console.log(`  [skip] ${dir} does not exist`)
      continue
    }

    const pngs = await findPngs(dir)
    totalPngs += pngs.length

    for (const pngPath of pngs) {
      const { name, base, dir: fileDir } = parse(pngPath)

      // Skip spritesheets
      if (SKIP_FILENAMES.has(base)) {
        console.log(`  [skip] ${pngPath} (spritesheet)`)
        skipped++
        continue
      }

      const webpPath = join(fileDir, `${name}.webp`)
      const pngStat = await stat(pngPath)
      const pngSize = pngStat.size

      try {
        await sharp(pngPath)
          .webp({ lossless: true })
          .toFile(webpPath)

        const webpStat = await stat(webpPath)
        const webpSize = webpStat.size
        const savings = pngSize - webpSize
        const pct = pngSize > 0 ? ((savings / pngSize) * 100).toFixed(1) : '0.0'

        totalPngBytes += pngSize
        totalWebpBytes += webpSize
        converted++

        const sizeKB = (s) => (s / 1024).toFixed(1)
        console.log(`  ${pngPath} -> ${sizeKB(pngSize)}KB -> ${sizeKB(webpSize)}KB (${pct}% saved)`)
      } catch (err) {
        console.error(`  [error] ${pngPath}: ${err.message}`)
      }
    }
  }

  console.log('')
  console.log('=== WebP Conversion Summary ===')
  console.log(`  Total PNGs found:    ${totalPngs}`)
  console.log(`  Converted:           ${converted}`)
  console.log(`  Skipped:             ${skipped}`)
  console.log(`  Total PNG size:      ${(totalPngBytes / 1024).toFixed(1)} KB`)
  console.log(`  Total WebP size:     ${(totalWebpBytes / 1024).toFixed(1)} KB`)
  const totalSaved = totalPngBytes - totalWebpBytes
  const totalPct = totalPngBytes > 0 ? ((totalSaved / totalPngBytes) * 100).toFixed(1) : '0.0'
  console.log(`  Total saved:         ${(totalSaved / 1024).toFixed(1)} KB (${totalPct}%)`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
