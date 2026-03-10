#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { ensureParentDir, parseArgs, readSourceInput } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 2500
const INPUT_COST_PER_MILLION = 0.8
const OUTPUT_COST_PER_MILLION = 4.0
const LOCAL_PAID_GENERATION_DISABLED = true

const REWRITE_SYSTEM_PROMPT = `You rewrite educational quiz facts for brevity in a fast-paced card combat game.
You receive a JSON fact object. Output ONLY these four fields as a JSON object:
- quizQuestion (max 12 words)
- correctAnswer (max 5 words, ideally 1-3)
- variants (5 structured variants, each with short questions and answers)
- distractors (exactly 8, each max 5 words / 30 chars)

Do NOT include any other fields (no id, statement, category, etc.). Output ONLY { quizQuestion, correctAnswer, variants, distractors }.

# ANSWER STYLE
- Answers are NOUNS, NUMBERS, or SHORT PHRASES — never sentences
- BAD: "Lightning is about five times hotter" → GOOD: "Five times hotter"
- BAD: "Cyanobacteria releasing oxygen through photosynthesis" → GOOD: "Cyanobacteria"
- BAD: "There are more possible chess games than atoms" → GOOD: "More chess games"

# VARIANT RULES
Output exactly 5 variants. Each is:
{ "question": "...", "type": "forward|reverse|negative|fill_blank|true_false", "correctAnswer": "...", "distractors": ["a","b","c"] }

Per-type limits:
- forward: question MAX 12 words, answer MAX 5 words
- reverse: question MAX 15 words, answer MAX 4 words (NOUN or short phrase)
- negative: question MAX 10 words ("Which is NOT..."), all options MAX 5 words
- fill_blank: sentence MAX 15 words, answer MAX 3 words (ideally 1 word/number)
- true_false: statement MAX 15 words, answer "True" or "False"
Each variant must have exactly 3 distractors (max 5 words each).

# DISTRACTOR RULES
Top-level distractors: exactly 8 items as objects { "text": "...", "difficultyTier": "easy|medium|hard" }
Distribution: 3 easy, 3 medium, 2 hard
Each max 5 words, max 30 characters
Similar length to correctAnswer (within 20% char count)

# CRITICAL
- Output valid JSON only. No markdown fences.
- The rewritten fact must still test the SAME knowledge as the original.
- Do NOT change the correct answer's meaning — only shorten its phrasing.
- If the original statement is already ≤20 words, keep it as-is.`

/** Fields that the rewrite may change */
const QA_FIELDS = ['quizQuestion', 'correctAnswer', 'variants', 'distractors']

/** Merge rewritten Q&A fields onto the original fact, preserving all metadata */
function mergeRewrite(original, rewritten) {
  const merged = { ...original }
  for (const field of QA_FIELDS) {
    if (rewritten[field] !== undefined) {
      merged[field] = rewritten[field]
    }
  }
  return merged
}

/** Validate that the rewrite response has the required Q&A fields */
function validateRewriteResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return 'Response is not an object'
  if (typeof parsed.quizQuestion !== 'string' || parsed.quizQuestion.trim().length === 0) {
    return 'Missing/empty quizQuestion'
  }
  if (typeof parsed.correctAnswer !== 'string' || parsed.correctAnswer.trim().length === 0) {
    return 'Missing/empty correctAnswer'
  }
  if (!Array.isArray(parsed.variants) || parsed.variants.length < 2) {
    return 'variants must be an array with at least 2 items'
  }
  if (!Array.isArray(parsed.distractors) || parsed.distractors.length < 4) {
    return 'distractors must be an array with at least 4 items'
  }
  return null
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

function estimateCostUsd(inputTokens, outputTokens) {
  return ((inputTokens / 1_000_000) * INPUT_COST_PER_MILLION) + ((outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION)
}

async function main() {
  const args = parseArgs(process.argv, {
    input: '',
    output: '',
    limit: 0,
    concurrency: 3,
    'dry-run': true,
    retries: 3,
    'rate-limit': 50,
  })

  if (!args.input || !args.output) {
    throw new Error('Usage: node batch-rewrite.mjs --input <json> --output <json> [--dry-run] [--limit N] [--concurrency 3]')
  }

  const inputPath = path.resolve(root, String(args.input))
  const outputPath = path.resolve(root, String(args.output))
  const dryRun = Boolean(args['dry-run'])
  const retries = Number(args.retries) || 3
  const rateLimit = Number(args['rate-limit']) || 50

  if (!dryRun && LOCAL_PAID_GENERATION_DISABLED) {
    throw new Error('Paid API rewrite is disabled in this repository. Use --dry-run and external Claude workers for live rewrite tasks.')
  }

  const allFacts = await readSourceInput(inputPath)
  const limit = Number(args.limit) > 0 ? Math.min(Number(args.limit), allFacts.length) : allFacts.length
  const facts = allFacts.slice(0, limit)

  console.log(`loaded ${facts.length} facts from ${inputPath}${dryRun ? ' (dry-run)' : ''}`)

  await ensureParentDir(outputPath)

  // --- Direct Anthropic API setup ---
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  if (!dryRun && !apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required unless --dry-run')
  }

  let anthropic = null
  if (!dryRun) {
    const mod = await import('@anthropic-ai/sdk')
    const Anthropic = mod.default
    anthropic = new Anthropic({ apiKey })
  }

  // --- Rate limiting ---
  const intervalMs = Math.max(50, Math.round(60_000 / Math.max(rateLimit, 1)))
  let nextAvailableAt = 0

  async function throttle() {
    const now = Date.now()
    if (now < nextAvailableAt) {
      await sleep(nextAvailableAt - now)
    }
    nextAvailableAt = Math.max(nextAvailableAt, Date.now()) + intervalMs
  }

  // --- Stats ---
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let callCount = 0

  function getStats() {
    return {
      totalInputTokens,
      totalOutputTokens,
      estimatedCost: estimateCostUsd(totalInputTokens, totalOutputTokens),
      callCount,
    }
  }

  // --- Worker pool ---
  const results = new Array(facts.length)
  const errors = []
  let index = 0
  let rewritten = 0

  async function worker() {
    while (true) {
      const current = index
      index += 1
      if (current >= facts.length) return

      const original = facts[current]
      const factId = original?.id ?? `index-${current}`

      if (dryRun) {
        results[current] = original
        rewritten += 1
        if (rewritten % 25 === 0) {
          console.log(`progress ${rewritten}/${facts.length} (dry-run)`)
        }
        continue
      }

      let lastError = null
      let success = false

      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          await throttle()
          callCount += 1

          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: REWRITE_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: JSON.stringify(original),
              },
            ],
          })

          // Track usage
          const inputTok = Number(response?.usage?.input_tokens || 0)
          const outputTok = Number(response?.usage?.output_tokens || 0)
          totalInputTokens += inputTok
          totalOutputTokens += outputTok

          const text = extractTextContent(response?.content)

          let parsed
          try {
            parsed = maybeJsonParse(text)
          } catch (parseErr) {
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
            lastError = { factId, index: current, error: msg, code: 'ResponseParseError' }
            // Parse errors are not retryable
            break
          }

          const validationError = validateRewriteResponse(parsed)
          if (validationError) {
            lastError = { factId, index: current, error: validationError, code: 'SchemaValidationError' }
            // Schema errors are not retryable
            break
          }

          results[current] = mergeRewrite(original, parsed)
          rewritten += 1
          success = true

          if (rewritten % 25 === 0) {
            const stats = getStats()
            console.log(`progress ${rewritten}/${facts.length} (errors=${errors.length}, cost=$${stats.estimatedCost.toFixed(2)})`)
          }
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          const status = /** @type {any} */ (err)?.status ?? /** @type {any} */ (err)?.code
          const retryable = String(status) === '429' || /5\d\d/.test(String(status)) || /timed out|timeout|abort/i.test(message)

          lastError = { factId, index: current, error: message, code: String(status) }

          if (!retryable || attempt >= retries) {
            break
          }

          const backoffMs = (2 ** attempt) * 1000 + Math.floor(Math.random() * 1000)
          await sleep(backoffMs)
        }
      }

      if (!success) {
        console.warn(`[warn] fact "${factId}": ${lastError?.error ?? 'unknown'} — keeping original`)
        errors.push(lastError || { factId, index: current, error: 'Unknown failure' })
        results[current] = original
      }
    }
  }

  const concurrency = Math.max(1, Number(args.concurrency) || 3)
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  await fs.writeFile(outputPath, JSON.stringify(results, null, 2) + '\n', 'utf8')

  const stats = getStats()
  console.log(`done: ${rewritten} facts rewritten, ${errors.length} errors, cost $${stats.estimatedCost.toFixed(2)}`)

  if (errors.length > 0) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const errorPath = path.join(root, 'data/generated', `errors-rewrite-${ts}.json`)
    await ensureParentDir(errorPath)
    await fs.writeFile(errorPath, JSON.stringify(errors, null, 2) + '\n', 'utf8')
    console.log(`error report: ${errorPath}`)
  }
}

main().catch((error) => {
  console.error('[batch-rewrite] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
