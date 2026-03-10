import { setTimeout as sleep } from 'node:timers/promises'
import fs from 'node:fs/promises'
import path from 'node:path'

const MODEL = 'claude-haiku-4-5-20251001'
const INPUT_COST_PER_MILLION = 0.8
const OUTPUT_COST_PER_MILLION = 4.0
const LOCAL_PAID_GENERATION_DISABLED = true

function estimateCostUsd(inputTokens, outputTokens) {
  return ((inputTokens / 1_000_000) * INPUT_COST_PER_MILLION) + ((outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION)
}

async function readLedgerTotalUsd(ledgerPath) {
  try {
    const text = await fs.readFile(ledgerPath, 'utf8')
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce((sum, line) => {
        try {
          const parsed = JSON.parse(line)
          return sum + Number(parsed?.deltaCostUsd || 0)
        } catch {
          return sum
        }
      }, 0)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return 0
    }
    throw error
  }
}

async function appendLedgerUsage(ledgerPath, usage) {
  if (!ledgerPath) return
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true })
  await fs.appendFile(ledgerPath, `${JSON.stringify(usage)}\n`, 'utf8')
}

function maybeJsonParse(text) {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim()
  return JSON.parse(fenced)
}

function extractTextContent(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim()
  }
  return ''
}

function schemaValidateFact(fact) {
  if (!fact || typeof fact !== 'object') return 'Fact is not an object'
  const requiredStringFields = ['id', 'statement', 'quizQuestion', 'correctAnswer']
  for (const field of requiredStringFields) {
    if (typeof fact[field] !== 'string' || fact[field].trim().length === 0) {
      return `Missing/invalid string field: ${field}`
    }
  }

  const category = fact.category
  const categoryOk = typeof category === 'string'
    || (Array.isArray(category) && category.length > 0 && category.every((item) => typeof item === 'string'))
  if (!categoryOk) {
    return 'category must be a non-empty string or array of strings'
  }

  if (!Array.isArray(fact.variants) || fact.variants.length < 2) {
    return 'variants must be an array with at least 2 items'
  }

  if (!Array.isArray(fact.distractors) || fact.distractors.length < 4) {
    return 'distractors must be an array with at least 4 items'
  }

  const distractorOk = fact.distractors.every((item) => {
    if (typeof item === 'string') return item.trim().length > 0
    if (item && typeof item === 'object' && typeof item.text === 'string') return item.text.trim().length > 0
    return false
  })
  if (!distractorOk) {
    return 'distractors entries must be strings or { text } objects'
  }

  return null
}

function mapError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const code = /** @type {any} */ (error)?.status ?? /** @type {any} */ (error)?.code ?? 'UNKNOWN'

  if (String(code) === '401' || /auth/i.test(message)) {
    return { error: message, retryable: false, code: 'AuthenticationError' }
  }
  if (String(code) === '400') {
    return { error: message, retryable: false, code: 'ValidationError' }
  }
  if (String(code) === '429') {
    return { error: message, retryable: true, code: 'RateLimitError' }
  }
  if (/timed out|timeout|abort/i.test(message)) {
    return { error: message, retryable: true, code: 'TimeoutError' }
  }
  if (/5\d\d/.test(String(code))) {
    return { error: message, retryable: true, code: 'ServerError' }
  }

  return { error: message, retryable: true, code: 'UnknownError' }
}

async function loadAnthropicClient(apiKey) {
  const mod = await import('@anthropic-ai/sdk')
  const Anthropic = mod.default
  return new Anthropic({ apiKey })
}

export function createHaikuClient(config = {}) {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || ''
  const rateLimit = Number(config.rateLimit || process.env.HAIKU_RATE_LIMIT || 50)
  const retryLimit = Math.max(0, Number(config.retries || process.env.HAIKU_RETRIES || 3))
  const dryRun = Boolean(config.dryRun)
  const maxCostUsd = Math.max(0, Number(config.maxCostUsd ?? process.env.HAIKU_MAX_COST_USD ?? 0))
  const ledgerPathRaw = String(config.budgetLedgerPath || process.env.HAIKU_BUDGET_LEDGER_PATH || '').trim()
  const budgetLedgerPath = ledgerPathRaw ? path.resolve(process.cwd(), ledgerPathRaw) : ''
  const budgetRefreshMs = Math.max(250, Number(config.budgetRefreshMs || process.env.HAIKU_BUDGET_REFRESH_MS || 2000))

  if (!dryRun && LOCAL_PAID_GENERATION_DISABLED) {
    throw new Error(
      'Paid Anthropic API generation is disabled in this repository. Use dry-run mode locally and route real generation through external Claude subscription workers.',
    )
  }

  if (!dryRun && !apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required unless dryRun=true')
  }

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let callCount = 0
  let errorCount = 0
  let retryCount = 0
  let nextAvailableAt = 0
  let clientPromise = null
  let lastBudgetRefreshAt = 0
  let cachedGlobalCostUsd = 0
  const retryEvents = []

  async function throttle() {
    const intervalMs = Math.max(50, Math.round(60_000 / Math.max(rateLimit, 1)))
    const now = Date.now()
    if (now < nextAvailableAt) {
      await sleep(nextAvailableAt - now)
    }
    nextAvailableAt = Math.max(nextAvailableAt, Date.now()) + intervalMs
  }

  async function getClient() {
    if (!clientPromise) {
      clientPromise = loadAnthropicClient(apiKey)
    }
    return clientPromise
  }

  async function refreshGlobalCost(force = false) {
    if (!budgetLedgerPath) return 0
    const now = Date.now()
    if (!force && now - lastBudgetRefreshAt < budgetRefreshMs) return cachedGlobalCostUsd
    cachedGlobalCostUsd = await readLedgerTotalUsd(budgetLedgerPath)
    lastBudgetRefreshAt = now
    return cachedGlobalCostUsd
  }

  async function budgetExceeded() {
    if (dryRun || maxCostUsd <= 0) return false
    if (budgetLedgerPath) {
      const spent = await refreshGlobalCost()
      return spent >= maxCostUsd
    }
    return estimateCostUsd(totalInputTokens, totalOutputTokens) >= maxCostUsd
  }

  async function trackUsage(usage) {
    const input = Number(usage?.input_tokens || 0)
    const output = Number(usage?.output_tokens || 0)
    totalInputTokens += input
    totalOutputTokens += output
    const deltaCostUsd = estimateCostUsd(input, output)
    if (budgetLedgerPath && deltaCostUsd > 0) {
      await appendLedgerUsage(budgetLedgerPath, {
        ts: new Date().toISOString(),
        pid: process.pid,
        model: MODEL,
        inputTokens: input,
        outputTokens: output,
        deltaCostUsd,
      })
      cachedGlobalCostUsd += deltaCostUsd
    }
  }

  function getStats() {
    return {
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: estimateCostUsd(totalInputTokens, totalOutputTokens),
      callCount,
      errorCount,
      retryCount,
      maxCostUsd,
      budgetLedgerPath: budgetLedgerPath || null,
      globalEstimatedCost: budgetLedgerPath ? cachedGlobalCostUsd : null,
    }
  }

  function resetStats() {
    totalInputTokens = 0
    totalOutputTokens = 0
    callCount = 0
    errorCount = 0
    retryCount = 0
    retryEvents.length = 0
  }

  async function generateFact(systemPrompt, sourceData, domainTag) {
    callCount += 1

    if (dryRun) {
      const id = sourceData?.id || sourceData?.item || sourceData?.name || `${domainTag}-${callCount}`
      const shortId = String(id).slice(0, 40)
      const sourceLabel = String(
        sourceData?.label
        || sourceData?.itemLabel
        || sourceData?.country
        || sourceData?.name
        || shortId,
      ).slice(0, 60)
      return {
        id: `dry-${String(id).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        statement: `Dry run fact for ${domainTag} source "${sourceLabel}".`,
        quizQuestion: `Item "${sourceLabel}" belongs to which domain bucket?`,
        correctAnswer: domainTag,
        variants: [
          {
            question: `Source label "${sourceLabel}" maps to which domain?`,
            type: 'forward',
            correctAnswer: domainTag,
            distractors: ['history', 'geography', 'language'],
          },
          {
            question: `Choose the domain for item "${sourceLabel}".`,
            type: 'forward',
            correctAnswer: domainTag,
            distractors: ['history', 'geography', 'language'],
          },
        ],
        distractors: [
          'history',
          'geography',
          'language',
          'space_astronomy',
        ],
        difficulty: 2,
        funScore: 5,
        wowFactor: 'Dry-run output only.',
        visualDescription: 'Pixel-art placeholder scene for dry run validation.',
        ageRating: 'kid',
        sourceName: sourceData?.sourceName || 'dry-run',
        sourceUrl: sourceData?.sourceUrl || null,
        type: 'fact',
        category: [domainTag],
        tags: ['dry-run'],
        dryRun: true,
      }
    }

    let lastError = null
    const maxAttempts = retryLimit + 1
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        if (await budgetExceeded()) {
          return {
            error: `Budget cap reached (maxCostUsd=${maxCostUsd})`,
            retryable: false,
            code: 'BudgetExceeded',
            attempts: attempt - 1,
            retries: Math.max(0, attempt - 1),
          }
        }

        await throttle()
        const client = await getClient()
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 1200,
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: JSON.stringify({ domain: domainTag, sourceData }),
            },
          ],
        })

        await trackUsage(response?.usage)
        const text = extractTextContent(response?.content)

        let parsed
        try {
          parsed = maybeJsonParse(text)
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error), retryable: false, code: 'ResponseParseError' }
        }

        const schemaError = schemaValidateFact(parsed)
        if (schemaError) {
          return {
            error: schemaError,
            retryable: false,
            code: 'SchemaValidationError',
            attempts: attempt,
            retries: Math.max(0, attempt - 1),
          }
        }

        parsed._generationMeta = {
          attempts: attempt,
          retries: Math.max(0, attempt - 1),
          lastRetryCode: lastError?.code || null,
        }

        return parsed
      } catch (error) {
        const mapped = mapError(error)
        lastError = mapped

        if (!mapped.retryable || attempt >= maxAttempts) {
          errorCount += 1
          return {
            ...mapped,
            attempts: attempt,
            retries: Math.max(0, attempt - 1),
          }
        }

        const backoffMs = (2 ** attempt) * 1000 + Math.floor(Math.random() * 1000)
        retryCount += 1
        retryEvents.push({
          ts: new Date().toISOString(),
          attempt,
          code: mapped.code,
          backoffMs,
          message: String(mapped.error || '').slice(0, 240),
        })
        await sleep(backoffMs)
      }
    }

    errorCount += 1
    return lastError || { error: 'Unknown failure', retryable: false, code: 'UnknownError' }
  }

    return {
      generateFact,
      getStats,
      resetStats,
      getRetryEvents: () => [...retryEvents],
    }
}
