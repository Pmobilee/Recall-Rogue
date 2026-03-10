#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './shared.mjs'
import fs from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated/qa-reports',
    output: 'data/generated/qa-reports/validation-summary.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))

  const names = await fs.readdir(inputDir)
  const validationFiles = names.filter((name) => /^validation-.*\.json$/.test(name))

  const summary = []
  for (const name of validationFiles) {
    const report = await readJson(path.join(inputDir, name))
    summary.push({
      file: name,
      totalFacts: report?.summary?.totalFacts ?? 0,
      schemaErrorCount: report?.summary?.schemaErrorCount ?? 0,
      visualDescriptionCoverage: report?.summary?.visualDescriptionCoverage ?? 0,
    })
  }

  await writeJson(outputPath, {
    generatedAt: new Date().toISOString(),
    files: summary.length,
    summary,
  })

  console.log(`validation summary: ${outputPath}`)
}

main().catch((error) => {
  console.error('[generate-validation-summary] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
