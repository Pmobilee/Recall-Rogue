// sprite-gen/gen-biome-tiles.mjs
// Usage: node --loader tsx sprite-gen/gen-biome-tiles.mjs [--biome <id>] [--tier <tier>] [--resume]
//
// Generates per-biome tile sprites via ComfyUI using BIOME_TILE_SPECS from biomeTileSpec.ts.
// When ComfyUI is not running, creates placeholder PNG files instead.

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { createCanvas } from 'canvas'

const COMFYUI_URL = 'http://localhost:8188'
const OUTPUT_ROOT = 'src/assets/sprites/tiles/biomes'
const HIRES_ROOT  = 'src/assets/sprites-hires/tiles/biomes'

// Inline the biome specs to avoid tsx dependency issues at runtime
const BIOME_TILE_SPECS = {
  limestone_caves: { primaryColor: 0xd4c8a8, secondaryColor: 0xb8aa88, autotileMode: 'blob47', hasAccent: false },
  clay_basin:      { primaryColor: 0xc4a882, secondaryColor: 0x9c7a5c, autotileMode: 'bitmask16', hasAccent: false },
  iron_seam:       { primaryColor: 0x8b5a2b, secondaryColor: 0x5a3010, autotileMode: 'bitmask16', hasAccent: true },
  root_tangle:     { primaryColor: 0x4a7c3f, secondaryColor: 0x2d4f28, autotileMode: 'bitmask16', hasAccent: true },
  peat_bog:        { primaryColor: 0x3d2b1f, secondaryColor: 0x5a3d28, autotileMode: 'bitmask16', hasAccent: false },
  basalt_maze:     { primaryColor: 0x333344, secondaryColor: 0x222233, autotileMode: 'blob47', hasAccent: true },
  salt_flats:      { primaryColor: 0xe8e8e0, secondaryColor: 0xd0d0c4, autotileMode: 'bitmask16', hasAccent: true },
  coal_veins:      { primaryColor: 0x1a1a1a, secondaryColor: 0x2a2a2a, autotileMode: 'bitmask16', hasAccent: false },
  granite_canyon:  { primaryColor: 0x888080, secondaryColor: 0x6a6060, autotileMode: 'bitmask16', hasAccent: true },
  sulfur_springs:  { primaryColor: 0xaaaa00, secondaryColor: 0x887700, autotileMode: 'bitmask16', hasAccent: true },
  obsidian_rift:   { primaryColor: 0x110022, secondaryColor: 0x220044, autotileMode: 'blob47', hasAccent: true },
  magma_shelf:     { primaryColor: 0xff3300, secondaryColor: 0xcc2200, autotileMode: 'bitmask16', hasAccent: true },
  crystal_geode:   { primaryColor: 0xaaffff, secondaryColor: 0x88dddd, autotileMode: 'blob47', hasAccent: true },
  fossil_layer:    { primaryColor: 0x887766, secondaryColor: 0x6a5a4a, autotileMode: 'bitmask16', hasAccent: true },
  quartz_halls:    { primaryColor: 0xffffff, secondaryColor: 0xe0e8e8, autotileMode: 'bitmask16', hasAccent: true },
  primordial_mantle:  { primaryColor: 0xff6600, secondaryColor: 0xcc4400, autotileMode: 'bitmask16', hasAccent: true },
  iron_core_fringe:   { primaryColor: 0x882200, secondaryColor: 0x661100, autotileMode: 'bitmask16', hasAccent: true },
  pressure_dome:      { primaryColor: 0x004488, secondaryColor: 0x003366, autotileMode: 'bitmask16', hasAccent: true },
  deep_biolume:       { primaryColor: 0x003366, secondaryColor: 0x002244, autotileMode: 'bitmask16', hasAccent: true },
  tectonic_scar:      { primaryColor: 0x660000, secondaryColor: 0x440000, autotileMode: 'bitmask16', hasAccent: false },
  temporal_rift:      { primaryColor: 0x8800ff, secondaryColor: 0x6600cc, autotileMode: 'bitmask16', hasAccent: true },
  alien_intrusion:    { primaryColor: 0x00ff88, secondaryColor: 0x00cc66, autotileMode: 'bitmask16', hasAccent: true },
  bioluminescent:     { primaryColor: 0x00ffcc, secondaryColor: 0x00ccaa, autotileMode: 'bitmask16', hasAccent: true },
  void_pocket:        { primaryColor: 0x000000, secondaryColor: 0x0a0a0a, autotileMode: 'blob47', hasAccent: true },
  echo_chamber:       { primaryColor: 0x666699, secondaryColor: 0x4a4a7a, autotileMode: 'bitmask16', hasAccent: true },
}

/**
 * Creates a placeholder 32×32 PNG using canvas, colored with the biome's primary color.
 * Used when ComfyUI is not available.
 */
function createPlaceholderPng(primaryColor, secondaryColor, size = 32) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')
  const r = (primaryColor >> 16) & 0xff
  const g = (primaryColor >> 8) & 0xff
  const b = primaryColor & 0xff
  const r2 = (secondaryColor >> 16) & 0xff
  const g2 = (secondaryColor >> 8) & 0xff
  const b2 = secondaryColor & 0xff
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.fillRect(0, 0, size, size)
  // Add a subtle secondary color border for visual distinction
  ctx.strokeStyle = `rgb(${r2},${g2},${b2})`
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
  return canvas.toBuffer('image/png')
}

/**
 * Generates a single tile sprite. Tries ComfyUI first, falls back to placeholder.
 */
async function generateTile(biomeId, category, variant, spec) {
  const filename = `${biomeId}_${category}_${String(variant).padStart(2, '0')}.png`
  const hiresDest = `${HIRES_ROOT}/${filename}`
  const loresDest = `${OUTPUT_ROOT}/${filename}`

  // Skip if already generated (--resume mode)
  if (process.argv.includes('--resume') && existsSync(hiresDest)) {
    console.log(`  SKIP ${filename} (already exists)`)
    return
  }

  // Try ComfyUI, fall back to placeholder
  let loResBuffer = null
  let hiResBuffer = null
  try {
    const response = await fetch(`${COMFYUI_URL}/system_stats`)
    if (response.ok) {
      // ComfyUI is running — TODO(codex): [integration] replace generation stub with full ComfyUI pipeline — needs human decision
      console.log(`  COMFYUI ${filename} (pipeline stub)`)
      loResBuffer = createPlaceholderPng(spec.primaryColor, spec.secondaryColor, 32)
      hiResBuffer = createPlaceholderPng(spec.primaryColor, spec.secondaryColor, 256)
    } else {
      throw new Error('ComfyUI not available')
    }
  } catch {
    // ComfyUI not running — create placeholder
    loResBuffer = createPlaceholderPng(spec.primaryColor, spec.secondaryColor, 32)
    hiResBuffer = createPlaceholderPng(spec.primaryColor, spec.secondaryColor, 256)
  }

  writeFileSync(loresDest, loResBuffer)
  writeFileSync(hiresDest, hiResBuffer)
  console.log(`  OK   ${filename}`)
}

async function main() {
  const biomeFilter = process.argv.includes('--biome')
    ? process.argv[process.argv.indexOf('--biome') + 1]
    : null

  const tierFilter = process.argv.includes('--tier')
    ? process.argv[process.argv.indexOf('--tier') + 1]
    : null

  // Ensure output directories exist
  mkdirSync(OUTPUT_ROOT, { recursive: true })
  mkdirSync(HIRES_ROOT, { recursive: true })

  const specs = Object.entries(BIOME_TILE_SPECS)
    .filter(([id]) => !biomeFilter || id === biomeFilter)

  for (const [biomeId, spec] of specs) {
    if (tierFilter) {
      // Simple tier check — shallow/mid/deep/extreme/anomaly by biome list
      const tierMap = {
        shallow: ['limestone_caves', 'clay_basin', 'iron_seam', 'root_tangle', 'peat_bog'],
        mid: ['basalt_maze', 'salt_flats', 'coal_veins', 'granite_canyon', 'sulfur_springs'],
        deep: ['obsidian_rift', 'magma_shelf', 'crystal_geode', 'fossil_layer', 'quartz_halls'],
        extreme: ['primordial_mantle', 'iron_core_fringe', 'pressure_dome', 'deep_biolume', 'tectonic_scar'],
        anomaly: ['temporal_rift', 'alien_intrusion', 'bioluminescent', 'void_pocket', 'echo_chamber'],
      }
      if (!tierMap[tierFilter]?.includes(biomeId)) continue
    }

    console.log(`\n[${biomeId}]`)
    const maxVariant = spec.autotileMode === 'blob47' ? 47 : 16

    for (const category of ['soil', 'rock']) {
      for (let v = 0; v < maxVariant; v++) {
        await generateTile(biomeId, category, v, spec)
      }
    }

    // Accent tile (if defined)
    if (spec.hasAccent) {
      await generateTile(biomeId, 'accent', 0, spec)
    }
  }

  console.log('\nBiome tile generation complete.')
}

main().catch(err => {
  console.error('Generation failed:', err)
  process.exit(1)
})
