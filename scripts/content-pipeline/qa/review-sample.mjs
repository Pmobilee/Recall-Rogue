#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listJsonlFiles, loadJsonl, parseArgs } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function sample(items, count) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

async function main() {
  const args = parseArgs(process.argv, {
    input: 'data/generated',
    output: 'samples/human-review/review-sample.md',
    perDomain: 10,
  })

  const inputDir = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const perDomain = Math.max(1, Number(args.perDomain) || 10)

  const files = await listJsonlFiles(inputDir)
  const chunks = ['# Human Review Sample\n']

  for (const file of files) {
    const domain = path.basename(file, '.jsonl')
    const facts = await loadJsonl(file)
    chunks.push(`## ${domain}`)

    for (const fact of sample(facts, perDomain)) {
      chunks.push(`- [ ] ${fact.statement}`)
      chunks.push(`  - Question: ${fact.quizQuestion}`)
      chunks.push(`  - Answer: ${fact.correctAnswer}`)
      chunks.push(`  - Source: ${fact.sourceName || 'n/a'} (${fact.sourceUrl || 'n/a'})`)
    }

    chunks.push('')
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${chunks.join('\n')}\n`, 'utf8')
  console.log(`review sample: ${outputPath}`)
}

main().catch((error) => {
  console.error('[review-sample] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
