#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHaikuClient } from './haiku-client.mjs'
import { ensureParentDir, loadPrompt, parseArgs, readSourceInput, toDomainTag } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function inferInputPath(domain) {
  const normalized = String(domain).replaceAll('-', '_')
  return path.join(root, 'data/raw', `${normalized}.json`)
}

async function main() {
  const args = parseArgs(process.argv, {
    domain: '',
    count: 5,
    input: '',
    output: '',
    'dry-run': false,
    'rate-limit': 50,
    retries: 3,
  })

  if (!args.domain) {
    throw new Error('Usage: node sample.mjs --domain <domain> [--count 5] [--output sample.json] [--dry-run]')
  }

  const inputPath = args.input
    ? path.resolve(root, String(args.input))
    : inferInputPath(args.domain)

  const sourceRows = await readSourceInput(inputPath)
  const count = Math.max(1, Math.min(Number(args.count) || 5, sourceRows.length))
  const rows = sourceRows.slice(0, count)

  const prompt = await loadPrompt(root, args.domain)
  const domainTag = toDomainTag(args.domain)
  const client = createHaikuClient({
    dryRun: Boolean(args['dry-run']),
    rateLimit: Number(args['rate-limit']) || 50,
    retries: Number(args.retries) || 3,
  })

  const results = []
  for (let i = 0; i < rows.length; i += 1) {
    const source = rows[i]
    const fact = await client.generateFact(prompt, source, domainTag)
    results.push(fact)
  }

  if (args.output) {
    const outPath = path.resolve(root, String(args.output))
    await ensureParentDir(outPath)
    await fs.writeFile(outPath, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
    console.log(`sample output: ${outPath}`)
  } else {
    console.log(JSON.stringify(results, null, 2))
  }

  const stats = client.getStats()
  console.log(`stats: calls=${stats.callCount} errors=${stats.errorCount} estimatedCost=$${stats.estimatedCost.toFixed(2)}`)
}

main().catch((error) => {
  console.error('[sample] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
