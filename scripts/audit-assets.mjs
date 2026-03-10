#!/usr/bin/env node
// scripts/audit-assets.mjs
// Build-time sprite asset audit.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, basename, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '../..')
const strict = process.argv.includes('--strict')
const IGNORED_MISSING_KEYS = new Set(['particle_dot', 'particle_square'])
const IGNORED_MISSING_PREFIXES = ['creature_', 'block_']

// --- Collect all sprite files ---
const SPRITE_DIRS = [
  join(ROOT, 'public/assets/sprites'),
  join(ROOT, 'public/assets/sprites-hires'),
]

/** @type {Set<string>} All sprite basenames (without extension) that exist on disk */
const diskSprites = new Set()

for (const dir of SPRITE_DIRS) {
  if (!existsSync(dir)) continue
  for (const file of readdirSync(dir, { recursive: true })) {
    const f = typeof file === 'string' ? file : file.toString()
    if (extname(f) === '.png') {
      diskSprites.add(basename(f, '.png'))
    }
  }
}

// --- Collect all sprite key references in code ---
/** @type {Set<string>} */
const codeRefs = new Set()

/** @type {Array<{key: string, file: string, line: number}>} */
const missingRefs = []

// Simpler approach — use readdirSync recursive
function getAllSourceFiles(baseDir) {
  const files = []
  if (!existsSync(baseDir)) return files
  const entries = readdirSync(baseDir, { recursive: true })
  for (const entry of entries) {
    const e = typeof entry === 'string' ? entry : entry.toString()
    // Ignore archived mining code from legacy versions during launch-readiness audits.
    if (e.includes('_archived-mining/')) continue
    if (e.endsWith('.ts') || e.endsWith('.svelte')) {
      files.push(join(baseDir, e))
    }
  }
  return files
}

const sourceFiles = getAllSourceFiles(join(ROOT, 'src'))

for (const filePath of sourceFiles) {
  const content = readFileSync(filePath, 'utf-8')
  if (content.includes('card-roguelite') && content.includes('removed mining dependency (stub)')) {
    continue
  }
  const lines = content.split('\n')

  lines.forEach((line, idx) => {
    // Match sprite key patterns: alphanumeric+underscore string literals
    const matches = line.matchAll(/['"]([a-z][a-z0-9_]{2,})['"]/g)
    for (const match of matches) {
      const key = match[1]
      // Heuristic: sprite keys contain underscores
      if (key.includes('_') && !key.startsWith('__') && !key.includes('://')) {
        if (key.endsWith('_')) continue
        codeRefs.add(key)
        // Only flag as missing if the key looks like a sprite key (contains common sprite prefixes)
        // and is used in a sprite-loading context
        if (diskSprites.size > 0 && !diskSprites.has(key)) {
          if (IGNORED_MISSING_KEYS.has(key)) continue
          if (IGNORED_MISSING_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
          // Check if this is actually a sprite reference (near setTexture, load.image, etc.)
          if (line.includes('setTexture') || line.includes('load.image') || line.includes('spriteKey') ||
              line.includes('getSpriteUrls') || line.includes('addSprite') || line.includes('texture')) {
            missingRefs.push({ key, file: relative(ROOT, filePath), line: idx + 1 })
          }
        }
      }
    }
  })
}

// --- Report ---
let hasErrors = false

// Orphan sprites (warnings only)
const orphans = [...diskSprites].filter(s => !codeRefs.has(s))
if (orphans.length > 0) {
  console.warn(`\n Warning: ${orphans.length} orphan sprite(s) with no code reference:`)
  for (const o of orphans.sort()) {
    console.warn(`   - ${o}`)
  }
}

// Missing sprite references (warnings in default mode, errors in strict mode)
if (missingRefs.length > 0) {
  if (strict) {
    hasErrors = true
  }
  const level = strict ? 'Error' : 'Warning'
  const fn = strict ? console.error : console.warn
  fn(`\n ${level}: ${missingRefs.length} code reference(s) to missing sprites:`)
  for (const ref of missingRefs) {
    fn(`   - "${ref.key}" in ${ref.file}:${ref.line}`)
  }
}

// Summary
console.log(`\n Asset Audit: ${diskSprites.size} sprites on disk, ${codeRefs.size} keys in code`)
if (orphans.length > 0) console.log(`   Warning: ${orphans.length} orphan(s)`)
if (missingRefs.length > 0) {
  const level = strict ? 'Error' : 'Warning'
  console.log(`   ${level}: ${missingRefs.length} missing reference(s)`)
}
if (!hasErrors && orphans.length === 0 && missingRefs.length === 0) console.log('   All clear!')

// Exit with 0 unless in strict mode with errors
if (hasErrors && strict) {
  process.exit(1)
}
