#!/usr/bin/env node
import fs from 'node:fs/promises'
import fssync from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHaikuClient } from './haiku-client.mjs'
import { ensureParentDir, loadJsonl, loadPrompt, parseArgs, readSourceInput, toDomainTag, toJsonlLine } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function sourceRecordId(row, index) {
  return String(row?.id ?? row?.item ?? row?.entity ?? row?.country ?? row?.species ?? row?.name ?? `row-${index}`)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    domain: '',
    output: '',
    limit: 0,
    concurrency: 3,
    resume: false,
    'batch-size': 100,
    'rate-limit': 50,
    retries: 3,
    'dry-run': false,
  })

  if (!args.input || !args.domain || !args.output) {
    throw new Error('Usage: node batch-generate.mjs --input <json> --domain <domain> --output <jsonl> [--dry-run]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const domainTag = toDomainTag(args.domain)

  const prompt = await loadPrompt(root, args.domain)
  const sourceRows = await readSourceInput(inputPath)
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), sourceRows.length) : sourceRows.length
  const rows = sourceRows.slice(0, limit)

  const alreadyProcessed = new Set()
  if (args.resume && fssync.existsSync(outputPath)) {
    const existing = await loadJsonl(outputPath)
    for (const row of existing) {
      const id = row?.sourceRecordId ?? row?.id
      if (id != null) alreadyProcessed.add(String(id))
    }
  }

  await ensureParentDir(outputPath)

  const stream = fssync.createWriteStream(outputPath, { flags: args.resume ? 'a' : 'w' })
  const client = createHaikuClient({
    dryRun: Boolean(args['dry-run']),
    rateLimit: Number(args['rate-limit']) || 50,
    retries: Number(args.retries) || 3,
  })

  const errors = []
  let index = 0
  let generated = 0
  let skipped = 0

  async function worker() {
    while (true) {
      const current = index
      index += 1
      if (current >= rows.length) return

      const source = rows[current]
      const sourceId = sourceRecordId(source, current)

      if (alreadyProcessed.has(sourceId)) {
        skipped += 1
        continue
      }

      const result = await client.generateFact(prompt, source, domainTag)
      if (result && typeof result === 'object' && 'error' in result) {
        errors.push({
          sourceRecordId: sourceId,
          index: current,
          domain: domainTag,
          ...result,
        })
        continue
      }

      const enriched = {
        ...result,
        sourceRecordId: sourceId,
        category: result?.category || domainTag,
      }

      stream.write(toJsonlLine(enriched))
      generated += 1

      if ((generated + skipped) % 25 === 0) {
        const stats = client.getStats()
        console.log(`progress ${generated + skipped}/${rows.length} (generated=${generated}, skipped=${skipped}, errors=${errors.length}, cost=$${stats.estimatedCost.toFixed(2)})`)
      }
    }
  }

  const concurrency = Math.max(1, Number(args.concurrency) || 3)
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  stream.end()

  const stats = client.getStats()
  console.log(`done generated=${generated} skipped=${skipped} errors=${errors.length} estimatedCost=$${stats.estimatedCost.toFixed(2)}`)

  if (errors.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const errorPath = path.join(root, 'data/generated', `errors-${domainTag}-${ts}.json`)
    await ensureParentDir(errorPath)
    await fs.writeFile(errorPath, `${JSON.stringify(errors, null, 2)}\n`, 'utf8')
    console.log(`error report: ${errorPath}`)
  }
}

main().catch((error) => {
  console.error('[batch-generate] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
