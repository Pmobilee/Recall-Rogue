#!/usr/bin/env node
/**
 * LLM-based categoryL2 backfill for existing facts.
 *
 * Uses OpenRouter (GPT-5.1 mini family) in domain batches, writes taxonomy IDs
 * into categoryL2, and syncs category[1] to that ID.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import dotenv from 'dotenv'
import {
  CANONICAL_TAXONOMY_DOMAINS,
  DOMAIN_LABELS,
  getSubcategoryDefs,
  hasSubcategoryTaxonomy,
  isValidSubcategoryId,
  resolveFactTaxonomyDomain,
  toTaxonomyPromptBlock,
} from './subcategory-taxonomy.mjs'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const { values } = parseArgs({
  options: {
    model: { type: 'string', default: 'openai/gpt-5.1-codex-mini' },
    'batch-size': { type: 'string', default: '40' },
    domains: { type: 'string', default: '' },
    'include-generated': { type: 'string', default: 'true' },
    'include-seed': { type: 'string', default: 'true' },
    'max-retries': { type: 'string', default: '4' },
    'max-batches': { type: 'string' },
    'dry-run': { type: 'string', default: 'false' },
    report: { type: 'string', default: 'data/generated/qa-reports/llm-subcategory-backfill-report.json' },
  },
})

function parseBoolean(value, key) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true
  if (['false', '0', 'no', 'n'].includes(normalized)) return false
  throw new Error(`invalid ${key}: ${value}`)
}

function parsePositiveInt(value, key) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`invalid ${key}: ${value}`)
  return parsed
}

function parseDomainList(csv) {
  const raw = String(csv || '').trim()
  if (!raw) return [...CANONICAL_TAXONOMY_DOMAINS]
  return raw
    .split(',')
    .map((item) => item.trim().replaceAll('-', '_'))
    .filter((item) => CANONICAL_TAXONOMY_DOMAINS.includes(item))
}

function trimForPrompt(value, max = 280) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function inferDomainFromGeneratedPath(filePath) {
  const stem = path.basename(filePath, '.jsonl').replaceAll('-', '_')
  if (CANONICAL_TAXONOMY_DOMAINS.includes(stem)) return stem
  if (stem.startsWith('geography_')) return 'geography'
  return null
}

async function collectGeneratedFiles() {
  const dir = path.join(ROOT, 'data', 'generated')
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith('.jsonl'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(dir, name))
}

async function collectSeedFiles() {
  const dir = path.join(ROOT, 'src', 'data', 'seed')
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  return names
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(dir, name))
}

async function loadJsonl(filePath) {
  const text = await fs.readFile(filePath, 'utf8')
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

async function loadJsonArray(filePath) {
  const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'))
  if (!Array.isArray(parsed)) return []
  return parsed
}

function toCategoryArray(value) {
  if (Array.isArray(value)) return [...value]
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function syncFactCategory(fact, domain, categoryL2) {
  const before = JSON.stringify(fact)

  const category = toCategoryArray(fact.category)
  if (category.length === 0) category.push(domain)
  const previousSecondary = category[1]
  category[1] = categoryL2
  if (previousSecondary && previousSecondary !== categoryL2 && !category[2]) {
    category[2] = previousSecondary
  }

  fact.category = category
  fact.categoryL1 = DOMAIN_LABELS[domain]
  fact.categoryL2 = categoryL2
  if (!fact.categoryL3 && category[2]) {
    fact.categoryL3 = category[2]
  }

  return before !== JSON.stringify(fact)
}

function buildPrompt(domain, batchItems) {
  return [
    'You are a strict taxonomy classifier.',
    `Domain: ${domain}`,
    '',
    'Pick exactly one categoryL2 ID for each fact from this taxonomy list:',
    toTaxonomyPromptBlock(domain),
    '',
    'Return JSON only with this shape:',
    '{"results":[{"id":"<fact id>","categoryL2":"<taxonomy id>","confidence":0.0,"reason":"<brief>"}]}',
    '',
    'Rules:',
    '- Use only categoryL2 IDs from the taxonomy list.',
    '- Output one result per input id.',
    '- Do not skip any input id.',
    '- Confidence must be between 0 and 1.',
    '',
    `Facts JSON (${batchItems.length} rows):`,
    JSON.stringify(batchItems),
  ].join('\n')
}

function extractJsonPayload(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // continue
    }
  }

  try {
    return JSON.parse(raw)
  } catch {
    // continue
  }

  const firstBracket = raw.indexOf('[')
  const lastBracket = raw.lastIndexOf(']')
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const sliced = raw.slice(firstBracket, lastBracket + 1)
    try {
      return JSON.parse(sliced)
    } catch {
      // continue
    }
  }

  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const sliced = raw.slice(firstBrace, lastBrace + 1)
    try {
      return JSON.parse(sliced)
    } catch {
      return null
    }
  }

  return null
}

async function callOpenRouter(prompt, model, maxRetries) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is missing')
  const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'

  let lastError = null
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://terra-miner.local',
          'X-Title': 'terra-miner-subcategory-backfill',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 4000,
          reasoning: { effort: 'low' },
          messages: [
            {
              role: 'system',
              content: 'Classify categoryL2 only. Output strict JSON object with a results array.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      })

      const text = await response.text()
      if (!response.ok) {
        throw new Error(`OpenRouter ${response.status}: ${text.slice(0, 400)}`)
      }

      const parsed = JSON.parse(text)
      const content = parsed?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error(`empty model content for model=${model}`)
      }
      return content
    } catch (error) {
      lastError = error
      const pauseMs = Math.min(15000, 500 * (2 ** (attempt - 1)))
      await new Promise((resolve) => setTimeout(resolve, pauseMs))
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function classifyBatch(domain, batchItems, model, maxRetries) {
  const basePrompt = buildPrompt(domain, batchItems)
  const parseAttempts = 3
  let results = null
  let parseFailure = null

  for (let attempt = 1; attempt <= parseAttempts; attempt += 1) {
    const prompt = attempt === 1
      ? basePrompt
      : `${basePrompt}\n\nIMPORTANT: Return ONLY valid JSON with the exact top-level shape {"results":[...]} and no extra keys.`

    const content = await callOpenRouter(prompt, model, maxRetries)
    const payload = extractJsonPayload(content)

    if (Array.isArray(payload)) {
      results = payload
      break
    }
    if (payload && typeof payload === 'object' && Array.isArray(payload.results)) {
      results = payload.results
      break
    }

    parseFailure = new Error(`model output not parseable as {"results":[...]} for ${domain} (attempt ${attempt}/${parseAttempts})`)
  }

  if (!Array.isArray(results)) {
    throw parseFailure ?? new Error(`model output not parseable as {"results":[...]} for ${domain}`)
  }

  const ids = new Set(batchItems.map((item) => item.id))
  const byId = new Map()
  for (const item of results) {
    if (!item || typeof item !== 'object') continue
    const id = String(item.id ?? '').trim()
    const categoryL2 = String(item.categoryL2 ?? '').trim()
    if (!id || !ids.has(id)) continue
    if (!isValidSubcategoryId(domain, categoryL2)) continue
    byId.set(id, {
      categoryL2,
      confidence: Number(item.confidence ?? 0),
      reason: trimForPrompt(item.reason ?? '', 120),
    })
  }

  return byId
}

async function classifyBatchWithFallback(domain, batchEntries, model, maxRetries) {
  const batchItems = batchEntries.map((entry) => entry.sample)
  try {
    return await classifyBatch(domain, batchItems, model, maxRetries)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (batchEntries.length <= 1) {
      console.warn(`[llm-backfill] unresolved single item in ${domain}: ${batchEntries[0]?.id || 'unknown'} (${reason})`)
      return new Map()
    }

    const middle = Math.ceil(batchEntries.length / 2)
    const left = batchEntries.slice(0, middle)
    const right = batchEntries.slice(middle)
    console.warn(`[llm-backfill] splitting ${domain} batch size=${batchEntries.length} after classifier failure: ${reason}`)

    const leftResult = await classifyBatchWithFallback(domain, left, model, maxRetries)
    const rightResult = await classifyBatchWithFallback(domain, right, model, maxRetries)
    const merged = new Map(leftResult)
    for (const [id, value] of rightResult.entries()) merged.set(id, value)
    return merged
  }
}

async function main() {
  const model = String(values.model || 'openai/gpt-5.1-codex-mini')
  const batchSize = parsePositiveInt(values['batch-size'], 'batch-size')
  const maxRetries = parsePositiveInt(values['max-retries'], 'max-retries')
  const maxBatches = values['max-batches'] ? parsePositiveInt(values['max-batches'], 'max-batches') : Number.POSITIVE_INFINITY
  const includeGenerated = parseBoolean(values['include-generated'], 'include-generated')
  const includeSeed = parseBoolean(values['include-seed'], 'include-seed')
  const dryRun = parseBoolean(values['dry-run'], 'dry-run')
  const domainFilter = new Set(parseDomainList(values.domains))

  const datasets = []
  if (includeGenerated) {
    for (const filePath of await collectGeneratedFiles()) {
      datasets.push({
        filePath,
        relPath: path.relative(ROOT, filePath),
        type: 'jsonl',
        fileHintDomain: inferDomainFromGeneratedPath(filePath),
        rows: await loadJsonl(filePath),
      })
    }
  }
  if (includeSeed) {
    for (const filePath of await collectSeedFiles()) {
      datasets.push({
        filePath,
        relPath: path.relative(ROOT, filePath),
        type: 'json',
        fileHintDomain: null,
        rows: await loadJsonArray(filePath),
      })
    }
  }

  const keyMap = new Map()
  let scannedRows = 0
  for (const [datasetIndex, dataset] of datasets.entries()) {
    for (const [rowIndex, fact] of dataset.rows.entries()) {
      if (!fact || typeof fact !== 'object') continue
      scannedRows += 1
      const id = String(fact.id ?? '').trim()
      if (!id) continue
      const domain = resolveFactTaxonomyDomain(fact, dataset.fileHintDomain || '')
      if (!domain || !hasSubcategoryTaxonomy(domain) || !domainFilter.has(domain)) continue

      const key = `${domain}::${id}`
      if (!keyMap.has(key)) {
        keyMap.set(key, {
          key,
          id,
          domain,
          refs: [],
          sample: {
            id,
            statement: trimForPrompt(fact.statement, 260),
            quizQuestion: trimForPrompt(fact.quizQuestion, 220),
            explanation: trimForPrompt(fact.explanation, 220),
            category: toCategoryArray(fact.category).slice(0, 3),
            categoryL1: String(fact.categoryL1 ?? '').trim(),
            tags: Array.isArray(fact.tags) ? fact.tags.slice(0, 8) : [],
          },
          validSeen: new Set(),
        })
      }

      const entry = keyMap.get(key)
      entry.refs.push({ datasetIndex, rowIndex })
      const currentL2 = String(fact.categoryL2 ?? '').trim()
      if (isValidSubcategoryId(domain, currentL2)) {
        entry.validSeen.add(currentL2)
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    model,
    batchSize,
    includeGenerated,
    includeSeed,
    dryRun,
    scannedRows,
    uniqueFactKeys: keyMap.size,
    domainFilter: [...domainFilter],
    totals: {
      alreadyValid: 0,
      autoPropagated: 0,
      llmCandidates: 0,
      llmClassified: 0,
      unresolved: 0,
      changedRows: 0,
      batchesRun: 0,
    },
    byDomain: {},
    unresolvedExamples: [],
    predictionSamples: [],
    fileChanges: [],
  }

  for (const domain of domainFilter) {
    report.byDomain[domain] = {
      alreadyValid: 0,
      autoPropagated: 0,
      llmCandidates: 0,
      llmClassified: 0,
      unresolved: 0,
      changedRows: 0,
    }
  }

  const llmQueueByDomain = new Map([...domainFilter].map((domain) => [domain, []]))
  const predictions = new Map()

  for (const entry of keyMap.values()) {
    const domainStats = report.byDomain[entry.domain]
    if (entry.validSeen.size === 1) {
      const validId = [...entry.validSeen][0]
      predictions.set(entry.key, { categoryL2: validId, source: 'existing' })
      domainStats.alreadyValid += 1
      report.totals.alreadyValid += 1
      continue
    }
    if (entry.validSeen.size > 1) {
      // conflicting existing values: send to LLM to force one canonical value
      llmQueueByDomain.get(entry.domain).push(entry)
      domainStats.llmCandidates += 1
      report.totals.llmCandidates += 1
      continue
    }
    llmQueueByDomain.get(entry.domain).push(entry)
    domainStats.llmCandidates += 1
    report.totals.llmCandidates += 1
  }

  for (const domain of domainFilter) {
    const queue = llmQueueByDomain.get(domain) ?? []
    if (queue.length === 0) continue

    const defs = getSubcategoryDefs(domain)
    if (defs.length === 0) continue

    for (let cursor = 0; cursor < queue.length; cursor += batchSize) {
      if (report.totals.batchesRun >= maxBatches) break
      const batch = queue.slice(cursor, cursor + batchSize)
      const batchItems = batch.map((entry) => entry.sample)

      const batchNo = report.totals.batchesRun + 1
      console.log(`[llm-backfill] ${domain} batch ${batchNo}: size=${batchItems.length}`)

      report.totals.batchesRun += 1
      const classified = await classifyBatchWithFallback(domain, batch, model, maxRetries)

      const missing = batch.filter((entry) => !classified.has(entry.id))
      if (missing.length > 0) {
        console.log(`[llm-backfill] ${domain} retry for ${missing.length} missing ids`)
        const retryClassified = await classifyBatchWithFallback(domain, missing, model, maxRetries)
        for (const [id, value] of retryClassified.entries()) classified.set(id, value)
      }

      for (const entry of batch) {
        const picked = classified.get(entry.id)
        if (!picked || !isValidSubcategoryId(domain, picked.categoryL2)) {
          report.totals.unresolved += 1
          report.byDomain[domain].unresolved += 1
          if (report.unresolvedExamples.length < 200) {
            report.unresolvedExamples.push({
              id: entry.id,
              domain,
              statement: entry.sample.statement,
            })
          }
          continue
        }

        predictions.set(entry.key, { ...picked, source: 'llm' })
        report.totals.llmClassified += 1
        report.byDomain[domain].llmClassified += 1
        if (report.predictionSamples.length < 200) {
          report.predictionSamples.push({
            id: entry.id,
            domain,
            categoryL2: picked.categoryL2,
            confidence: picked.confidence,
            reason: picked.reason,
          })
        }
      }
    }
  }

  for (const entry of keyMap.values()) {
    const predicted = predictions.get(entry.key)
    if (!predicted || !isValidSubcategoryId(entry.domain, predicted.categoryL2)) continue
    for (const ref of entry.refs) {
      const fact = datasets[ref.datasetIndex].rows[ref.rowIndex]
      const changed = syncFactCategory(fact, entry.domain, predicted.categoryL2)
      if (changed) {
        report.totals.changedRows += 1
        report.byDomain[entry.domain].changedRows += 1
      }
    }
  }

  if (!dryRun) {
    for (const dataset of datasets) {
      if (dataset.type === 'jsonl') {
        const content = dataset.rows.map((row) => JSON.stringify(row)).join('\n')
        await fs.writeFile(dataset.filePath, `${content}\n`, 'utf8')
      } else {
        await fs.writeFile(dataset.filePath, `${JSON.stringify(dataset.rows, null, 2)}\n`, 'utf8')
      }
      report.fileChanges.push({ path: dataset.relPath, rows: dataset.rows.length })
    }
  }

  const reportPath = path.resolve(ROOT, values.report)
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

  console.log('[llm-backfill] complete')
  console.log(JSON.stringify({
    model,
    dryRun,
    scannedRows: report.scannedRows,
    uniqueFactKeys: report.uniqueFactKeys,
    llmCandidates: report.totals.llmCandidates,
    llmClassified: report.totals.llmClassified,
    unresolved: report.totals.unresolved,
    changedRows: report.totals.changedRows,
    batchesRun: report.totals.batchesRun,
    report: path.relative(ROOT, reportPath),
  }, null, 2))
}

main().catch((error) => {
  console.error('[llm-backfill] failed:', error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
