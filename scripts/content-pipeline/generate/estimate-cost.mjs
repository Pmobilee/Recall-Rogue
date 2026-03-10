#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPrompt, parseArgs, readSourceInput, toDomainTag } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const INPUT_COST_PER_MILLION = 0.8
const OUTPUT_COST_PER_MILLION = 4.0

function estimateTokensForRecord(record, promptChars = 0) {
  const sourceChars = JSON.stringify(record).length
  const totalInputChars = sourceChars + promptChars
  const inputTokens = Math.ceil(totalInputChars / 4)
  const outputTokens = 650
  return { inputTokens, outputTokens }
}

function estimateUsd(inputTokens, outputTokens) {
  return ((inputTokens / 1_000_000) * INPUT_COST_PER_MILLION) + ((outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    domain: '',
    limit: 0,
  })

  if (!args.input) {
    throw new Error('Usage: node estimate-cost.mjs --input <raw-json> [--domain <domain>] [--limit <n>]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const rows = await readSourceInput(inputPath)
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), rows.length) : rows.length
  const sampleRows = rows.slice(0, limit)

  const inferredDomain = args.domain || path.basename(inputPath).replace(/\.json$/i, '').replaceAll('_', '-')
  const domain = toDomainTag(inferredDomain)

  let promptChars = 0
  try {
    const prompt = await loadPrompt(root, inferredDomain)
    promptChars = prompt.length
  } catch {
    promptChars = 0
  }

  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (const row of sampleRows) {
    const estimate = estimateTokensForRecord(row, promptChars)
    totalInputTokens += estimate.inputTokens
    totalOutputTokens += estimate.outputTokens
  }

  const totalCost = estimateUsd(totalInputTokens, totalOutputTokens)
  const avgPerRecord = sampleRows.length > 0 ? totalCost / sampleRows.length : 0

  console.log(`Domain: ${domain}`)
  console.log(`Records: ${sampleRows.length}`)
  console.log(`Input tokens (est): ${totalInputTokens}`)
  console.log(`Output tokens (est): ${totalOutputTokens}`)
  console.log(`Average cost/record: $${avgPerRecord.toFixed(6)}`)
  console.log(`Total cost: $${totalCost.toFixed(2)}`)
}

main().catch((error) => {
  console.error('[estimate-cost] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
