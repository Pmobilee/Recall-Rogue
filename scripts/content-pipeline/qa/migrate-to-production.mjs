#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/production-facts.jsonl',
    report: 'data/generated/qa-reports/migration-report.json',
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const reportPath = path.resolve(root, String(args.report))

  const files = await listJsonlFiles(inputDir)
  const merged = []
  const perFile = {}

  for (const file of files) {
    const rows = await loadJsonl(file)
    const key = path.basename(file, '.jsonl')
    perFile[key] = rows.length
    merged.push(...rows)
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  const jsonl = merged.map((row) => JSON.stringify(row)).join('\n')
  await fs.writeFile(outputPath, `${jsonl}${jsonl.length > 0 ? '\n' : ''}`, 'utf8')

  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    files: perFile,
    totalFacts: merged.length,
    outputPath,
  }, null, 2)}\n`, 'utf8')

  console.log(`migrated ${merged.length} facts to ${outputPath}`)
}

main().catch((error) => {
  console.error('[migrate-to-production] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
