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
    'max-cost-usd': Number(process.env.HAIKU_MAX_COST_USD || 0),
    'budget-ledger': process.env.HAIKU_BUDGET_LEDGER_PATH || '',
    'retry-report-limit': 5000,
    'retry-flag-threshold': 3,
    'dry-run': true,
  })

  if (!args.input || !args.domain || !args.output) {
    throw new Error('Usage: node batch-generate.mjs --input <json> --domain <domain> --output <jsonl> [--dry-run]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const domainTag = toDomainTag(args.domain)
  const maxCostUsd = Math.max(0, Number(args['max-cost-usd']) || 0)
  const budgetLedger = String(args['budget-ledger'] || '').trim()
  const budgetLedgerPath = budgetLedger ? path.resolve(root, budgetLedger) : ''
  const retryReportLimit = Math.max(0, Number(args['retry-report-limit']) || 5000)
  const retryFlagThreshold = Math.max(1, Number(args['retry-flag-threshold']) || 3)
  const dryRun = Boolean(args['dry-run'])

  if (!dryRun) {
    throw new Error('Paid API generation is disabled. Run with --dry-run true and use external Claude workers for live generation.')
  }

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
    dryRun,
    rateLimit: Number(args['rate-limit']) || 50,
    retries: Number(args.retries) || 3,
    maxCostUsd,
    budgetLedgerPath,
  })

  const errors = []
  const retryEntries = []
  const retryFlagged = []
  let budgetExceeded = false
  let index = 0
  let generated = 0
  let skipped = 0

  async function worker() {
    while (true) {
      if (budgetExceeded) return

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
        const retriesUsed = Math.max(0, Number(result?.retries) || 0)
        errors.push({
          sourceRecordId: sourceId,
          index: current,
          domain: domainTag,
          ...result,
        })
        if (retriesUsed >= retryFlagThreshold && retryFlagged.length < retryReportLimit) {
          retryFlagged.push({
            sourceRecordId: sourceId,
            index: current,
            retries: retriesUsed,
            attempts: Math.max(1, Number(result?.attempts) || retriesUsed + 1),
            status: 'failed_after_retries',
            code: result?.code || null,
            error: String(result?.error || '').slice(0, 240),
          })
        }
        if (result.code === 'BudgetExceeded') {
          budgetExceeded = true
          return
        }
        continue
      }

      const generationMeta = result?._generationMeta && typeof result._generationMeta === 'object'
        ? result._generationMeta
        : null

      if (generationMeta?.retries > 0 && retryEntries.length < retryReportLimit) {
        retryEntries.push({
          sourceRecordId: sourceId,
          index: current,
          retries: generationMeta.retries,
          attempts: generationMeta.attempts,
          lastRetryCode: generationMeta.lastRetryCode || null,
        })
      }

      const retriesUsed = Math.max(0, Number(generationMeta?.retries) || 0)
      if (retriesUsed >= retryFlagThreshold && retryFlagged.length < retryReportLimit) {
        retryFlagged.push({
          sourceRecordId: sourceId,
          index: current,
          retries: retriesUsed,
          attempts: Math.max(1, Number(generationMeta?.attempts) || retriesUsed + 1),
          status: 'succeeded_after_retries',
          code: generationMeta?.lastRetryCode || null,
        })
      }

      if (result && typeof result === 'object' && '_generationMeta' in result) {
        delete result._generationMeta
      }

      const enriched = {
        ...result,
        sourceRecordId: sourceId,
        category: result?.category || domainTag,
        generationRetries: retriesUsed,
        generationRetryFlagged: retriesUsed >= retryFlagThreshold,
      }

      stream.write(toJsonlLine(enriched))
      generated += 1

      if ((generated + skipped) % 25 === 0) {
        const stats = client.getStats()
        console.log(`progress ${generated + skipped}/${rows.length} (generated=${generated}, skipped=${skipped}, errors=${errors.length}, retries=${stats.retryCount}, flagged=${retryFlagged.length}, cost=$${stats.estimatedCost.toFixed(2)})`)
      }
    }
  }

  const concurrency = Math.max(1, Number(args.concurrency) || 3)
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  stream.end()

  const stats = client.getStats()
  console.log(`done generated=${generated} skipped=${skipped} errors=${errors.length} retries=${stats.retryCount} flagged=${retryFlagged.length} estimatedCost=$${stats.estimatedCost.toFixed(2)} budgetExceeded=${budgetExceeded}`)

  if (errors.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const errorPath = path.join(root, 'data/generated', `errors-${domainTag}-${ts}.json`)
    await ensureParentDir(errorPath)
    await fs.writeFile(errorPath, `${JSON.stringify(errors, null, 2)}\n`, 'utf8')
    console.log(`error report: ${errorPath}`)
  }

  const retryEvents = typeof client.getRetryEvents === 'function' ? client.getRetryEvents() : []
  if (retryEntries.length > 0 || retryEvents.length > 0 || retryFlagged.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const retryPath = path.join(root, 'data/generated', `retries-${domainTag}-${ts}.json`)
    await ensureParentDir(retryPath)
    await fs.writeFile(retryPath, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      domain: domainTag,
      summary: {
        generated,
        skipped,
        errors: errors.length,
        retryCount: stats.retryCount,
        retryEntries: retryEntries.length,
        retryEvents: retryEvents.length,
        retryFlagThreshold,
        retryFlagged: retryFlagged.length,
        reportTruncated: (
          retryEntries.length >= retryReportLimit
          || retryFlagged.length >= retryReportLimit
        ),
      },
      retryEntries,
      retryFlagged,
      retryEvents,
    }, null, 2)}\n`, 'utf8')
    console.log(`retry report: ${retryPath}`)
  }

  if (budgetExceeded) {
    process.exit(2)
  }
}

main().catch((error) => {
  console.error('[batch-generate] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
