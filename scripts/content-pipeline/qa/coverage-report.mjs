#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function summarizeFacts(facts) {
  const difficulty = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let visualCount = 0

  for (const fact of facts) {
    const d = Number(fact?.difficulty)
    if (difficulty[d] != null) difficulty[d] += 1
    if (typeof fact?.visualDescription === 'string' && fact.visualDescription.trim().length > 0) {
      visualCount += 1
    }
  }

  return {
    total: facts.length,
    difficulty,
    visualCoverage: facts.length > 0 ? Number((visualCount / facts.length).toFixed(4)) : 0,
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/coverage-report.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const files = await listJsonlFiles(inputDir)

  const domains = {}
  for (const file of files) {
    const facts = await loadJsonl(file)
    domains[path.basename(file, '.jsonl')] = summarizeFacts(facts)
  }

  await writeJson(outputPath, {
    generatedAt: new Date().toISOString(),
    domains,
  })

  console.log(`coverage report: ${outputPath}`)
}

main().catch((error) => {
  console.error('[coverage-report] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
