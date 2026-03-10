import { setTimeout as sleep } from 'node:timers/promises'

const MODEL = 'claude-haiku-4-5-20251001'
const INPUT_COST_PER_MILLION = 0.8
const OUTPUT_COST_PER_MILLION = 4.0

function estimateCostUsd(inputTokens, outputTokens) {
  return ((inputTokens / 1_000_000) * INPUT_COST_PER_MILLION) + ((outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION)
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
  const retries = Number(config.retries || process.env.HAIKU_RETRIES || 3)
  const dryRun = Boolean(config.dryRun)

  if (!dryRun && !apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required unless dryRun=true')
  }

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let callCount = 0
  let errorCount = 0
  let nextAvailableAt = 0
  let clientPromise = null

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

  function trackUsage(usage) {
    const input = Number(usage?.input_tokens || 0)
    const output = Number(usage?.output_tokens || 0)
    totalInputTokens += input
    totalOutputTokens += output
  }

  function getStats() {
    return {
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: estimateCostUsd(totalInputTokens, totalOutputTokens),
      callCount,
      errorCount,
    }
  }

  function resetStats() {
    totalInputTokens = 0
    totalOutputTokens = 0
    callCount = 0
    errorCount = 0
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
    for (let attempt = 1; attempt <= retries; attempt += 1) {
      try {
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

        trackUsage(response?.usage)
        const text = extractTextContent(response?.content)

        let parsed
        try {
          parsed = maybeJsonParse(text)
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error), retryable: false, code: 'ResponseParseError' }
        }

        const schemaError = schemaValidateFact(parsed)
        if (schemaError) {
          return { error: schemaError, retryable: false, code: 'SchemaValidationError' }
        }

        return parsed
      } catch (error) {
        const mapped = mapError(error)
        lastError = mapped

        if (!mapped.retryable || attempt >= retries) {
          errorCount += 1
          return mapped
        }

        const backoffMs = (2 ** attempt) * 1000 + Math.floor(Math.random() * 1000)
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
  }
}
