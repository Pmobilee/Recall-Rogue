import { setTimeout as sleep } from 'node:timers/promises'

const LOCAL_PAID_GENERATION_DISABLED = true

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function sourceLabel(sourceData, fallback) {
  const value = sourceData?.label
    || sourceData?.itemLabel
    || sourceData?.entityLabel
    || sourceData?.country
    || sourceData?.name
    || sourceData?.title
    || fallback
  return String(value || fallback).slice(0, 80)
}

function buildDistractors(domainTag) {
  const defaults = [
    'history',
    'geography',
    'biology',
    'astronomy',
    'language',
    'mythology',
    'culture',
  ]
  const filtered = defaults.filter((item) => item !== domainTag)
  return filtered.slice(0, 4)
}

function buildVariants(label, domainTag, answer) {
  const distractors = buildDistractors(domainTag).slice(0, 3)
  return [
    {
      question: `Which domain includes "${label}"?`,
      type: 'forward',
      correctAnswer: answer,
      distractors,
    },
    {
      question: `"${label}" belongs to which topic area?`,
      type: 'forward',
      correctAnswer: answer,
      distractors,
    },
  ]
}

function estimateCostUsd() {
  // Local paid generation is disabled: keep compatibility surface but hardcode zero spend.
  return 0
}

export function createHaikuClient(config = {}) {
  const dryRun = config.dryRun !== false
  const rateLimit = Math.max(1, Number(config.rateLimit || process.env.HAIKU_RATE_LIMIT || 50))
  const retryLimit = Math.max(0, Number(config.retries || process.env.HAIKU_RETRIES || 3))
  const maxCostUsd = Math.max(0, Number(config.maxCostUsd ?? process.env.HAIKU_MAX_COST_USD ?? 0))
  const budgetLedgerPath = config.budgetLedgerPath || process.env.HAIKU_BUDGET_LEDGER_PATH || ''

  if (!dryRun && LOCAL_PAID_GENERATION_DISABLED) {
    throw new Error(
      'Paid Anthropic API generation is disabled in this repository. Use external Claude subscription workers for live fact creation.',
    )
  }

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let callCount = 0
  let errorCount = 0
  let retryCount = 0
  let nextAvailableAt = 0
  const retryEvents = []

  async function throttle() {
    const intervalMs = Math.max(50, Math.round(60_000 / rateLimit))
    const now = Date.now()
    if (now < nextAvailableAt) {
      await sleep(nextAvailableAt - now)
    }
    nextAvailableAt = Math.max(nextAvailableAt, Date.now()) + intervalMs
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
      globalEstimatedCost: 0,
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

  async function generateFact(_systemPrompt, sourceData, domainTag) {
    callCount += 1
    await throttle()

    try {
      const sourceId = sourceData?.id
        || sourceData?.item
        || sourceData?.entity
        || sourceData?.country
        || sourceData?.species
        || sourceData?.name
        || sourceData?.title
        || `${domainTag}-${callCount}`

      const cleanId = sanitizeId(sourceId) || `${domainTag}-${callCount}`
      const label = sourceLabel(sourceData, cleanId)
      const answer = String(domainTag || 'general_knowledge')
      const distractors = buildDistractors(answer)

      return {
        id: `dry-${cleanId}`,
        statement: `"${label}" is classified under ${answer}.`,
        quizQuestion: `Which domain matches "${label}"?`,
        correctAnswer: answer,
        variants: buildVariants(label, answer, answer),
        distractors,
        difficulty: 2,
        funScore: 5,
        wowFactor: 'Dry-run placeholder generated locally.',
        visualDescription: 'Placeholder visual description for offline dry-run pipeline checks.',
        ageRating: 'kid',
        sourceName: sourceData?.sourceName || sourceData?.sourceDataset || 'worker-dry-run',
        sourceUrl: sourceData?.sourceUrl || sourceData?.url || null,
        type: 'fact',
        category: [answer],
        tags: ['dry-run', 'local-generator'],
        dryRun: true,
        _generationMeta: {
          attempts: 1,
          retries: 0,
          lastRetryCode: null,
        },
      }
    } catch (error) {
      errorCount += 1
      return {
        error: error instanceof Error ? error.message : String(error),
        retryable: false,
        code: 'DryRunGenerationError',
        attempts: 1,
        retries: 0,
      }
    }
  }

  return {
    generateFact,
    getStats,
    resetStats,
    getRetryEvents: () => [...retryEvents],
  }
}
