#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../../..')

/**
 * Merge Japanese facts into the main facts database
 */
async function mergeJapaneseFacts() {
  try {
    console.log('Starting Japanese facts merge...\n')

    const japaneseDir = path.join(PROJECT_ROOT, 'data', 'raw', 'japanese')
    const factsDbPath = path.join(PROJECT_ROOT, 'src', 'data', 'seed', 'facts-generated.json')
    const oldVocabPath = path.join(PROJECT_ROOT, 'src', 'data', 'seed', 'vocab-n3.json')

    // 1. Read all Japanese fact files
    console.log(`Reading Japanese facts from: ${japaneseDir}`)
    const files = await fs.readdir(japaneseDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    console.log(`Found ${jsonFiles.length} JSON files\n`)

    let newJapaneseFacts = []
    for (const file of jsonFiles) {
      const filePath = path.join(japaneseDir, file)
      try {
        const facts = await readJson(filePath)
        if (Array.isArray(facts)) {
          newJapaneseFacts = newJapaneseFacts.concat(facts)
          console.log(`  ✓ ${file}: ${facts.length} facts`)
        }
      } catch (err) {
        console.error(`  ✗ Error reading ${file}: ${err.message}`)
      }
    }
    console.log(`Total new Japanese facts loaded: ${newJapaneseFacts.length}\n`)

    // 2. Read existing facts database
    console.log(`Reading facts database from: ${factsDbPath}`)
    let existingFacts = await readJson(factsDbPath)
    if (!Array.isArray(existingFacts)) {
      existingFacts = []
    }
    console.log(`Existing facts count: ${existingFacts.length}\n`)

    // 3. Remove existing Japanese facts
    console.log('Removing existing Japanese facts...')
    const beforeRemoval = existingFacts.length
    existingFacts = existingFacts.filter(fact => {
      if (!fact || typeof fact !== 'object') return true
      const id = String(fact.id || '')
      const language = String(fact.language || '')
      const domain = String(fact.domain || '')
      return !(
        id.startsWith('ja-') ||
        language === 'ja' ||
        domain === 'vocab_ja'
      )
    })
    const removedCount = beforeRemoval - existingFacts.length
    console.log(`Removed ${removedCount} Japanese facts\n`)

    // 4. Append new Japanese facts
    console.log('Appending new Japanese facts...')
    const allFacts = [...existingFacts, ...newJapaneseFacts]
    console.log(`Total facts before dedup: ${allFacts.length}\n`)

    // 5. Deduplicate by id (keep first occurrence)
    console.log('Deduplicating by id...')
    const seenIds = new Set()
    const dedupedFacts = []
    let dupCount = 0
    for (const fact of allFacts) {
      if (!fact || typeof fact !== 'object') continue
      const id = String(fact.id || '')
      if (!id) {
        dedupedFacts.push(fact)
        continue
      }
      if (seenIds.has(id)) {
        dupCount += 1
        continue
      }
      seenIds.add(id)
      dedupedFacts.push(fact)
    }
    console.log(`Found and removed ${dupCount} duplicate IDs\n`)

    // 6. Write result back
    console.log(`Writing updated facts database to: ${factsDbPath}`)
    await writeJson(factsDbPath, dedupedFacts)
    console.log(`✓ Database updated: ${dedupedFacts.length} facts\n`)

    // 7. Handle old vocab-n3.json sample file
    console.log('Checking for old vocab-n3.json sample file...')
    try {
      const oldVocabData = await readJson(oldVocabPath)
      if (Array.isArray(oldVocabData) && oldVocabData.length > 0) {
        const firstFact = oldVocabData[0]
        if (
          firstFact &&
          typeof firstFact === 'object' &&
          (String(firstFact.language || '') === 'ja' ||
            String(firstFact.id || '').startsWith('ja-'))
        ) {
          const backupPath = `${oldVocabPath}.bak`
          await fs.rename(oldVocabPath, backupPath)
          console.log(`✓ Renamed ${oldVocabPath} → ${backupPath}\n`)
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn(`  ⚠ Could not process vocab-n3.json: ${err.message}\n`)
      }
    }

    // 8. Print summary
    console.log('═'.repeat(60))
    console.log('MERGE SUMMARY')
    console.log('═'.repeat(60))
    console.log(`Removed:     ${removedCount} existing Japanese facts`)
    console.log(`Added:       ${newJapaneseFacts.length} new Japanese facts`)
    console.log(`Deduped:     ${dupCount} duplicate IDs`)
    console.log(`Final total: ${dedupedFacts.length} facts`)
    console.log('═'.repeat(60))
    console.log('\n✓ Japanese facts merge complete!')

  } catch (err) {
    console.error('\n✗ Fatal error during merge:')
    console.error(err.message)
    process.exit(1)
  }
}

mergeJapaneseFacts()
