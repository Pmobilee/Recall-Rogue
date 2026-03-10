#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, normalizeText, parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function keyForFact(fact) {
  return `${normalizeText(fact.statement)}::${normalizeText(fact.correctAnswer)}`
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/cross-domain-dedup.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))

  const files = await listJsonlFiles(inputDir)
  const seen = new Map()
  const duplicates = []

  for (const file of files) {
    const domain = path.basename(file, '.jsonl')
    const facts = await loadJsonl(file)
    for (const fact of facts) {
      const key = keyForFact(fact)
      const first = seen.get(key)
      if (first) {
        duplicates.push({
          key,
          first,
          duplicate: {
            domain,
            id: fact.id,
          },
        })
      } else {
        seen.set(key, { domain, id: fact.id })
      }
    }
  }

  await writeJson(outputPath, {
    scannedFiles: files.length,
    duplicates: duplicates.length,
    items: duplicates,
  })

  console.log(`cross-domain dedup report: ${outputPath} (${duplicates.length} duplicates)`)
}

main().catch((error) => {
  console.error('[cross-domain-dedup] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
