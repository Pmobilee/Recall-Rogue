#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs, writeJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'data/generated/qa-reports/id-collision-gate.json',
    strict: false,
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const strict = Boolean(args.strict)

  const files = await listJsonlFiles(inputDir)
  const seenById = new Map()
  const duplicates = []
  let totalFacts = 0

  for (const filePath of files) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await loadJsonl(filePath)
    const rel = path.relative(root, filePath)
    for (let i = 0; i < rows.length; i += 1) {
      totalFacts += 1
      const id = String(rows[i]?.id ?? '').trim()
      if (!id) continue
      const first = seenById.get(id)
      if (!first) {
        seenById.set(id, { file: rel, index: i })
        continue
      }
      duplicates.push({
        id,
        first,
        duplicate: { file: rel, index: i },
      })
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    inputDir,
    files: files.map((filePath) => path.relative(root, filePath)),
    summary: {
      totalFiles: files.length,
      totalFacts,
      uniqueIds: seenById.size,
      duplicateIds: duplicates.length,
      pass: duplicates.length === 0,
    },
    duplicates,
  }

  await writeJson(outputPath, report)
  console.log(JSON.stringify({
    ok: report.summary.pass,
    outputPath,
    duplicates: duplicates.length,
  }, null, 2))

  if (strict && duplicates.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[id-collision-gate] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
