import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TIMEOUT_MS = 45_000

function coerceValue(value) {
  if (value === 'true') return true
  if (value === 'false') return false
  const asNumber = Number(value)
  if (!Number.isNaN(asNumber) && value.trim() !== '') return asNumber
  return value
}

export function parseCliArgs(argv, defaults = {}) {
  const out = { ...defaults }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const next = argv[i + 1]

    if (next == null || next.startsWith('--')) {
      out[key] = true
      continue
    }

    out[key] = coerceValue(next)
    i += 1
  }

  return out
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchJson(url, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    retries = 3,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = 1_250,
    onRetry,
  } = options

  let attempt = 0

  while (attempt <= retries) {
    attempt += 1

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500
        const detail = await response.text()
        const error = new Error(`HTTP ${response.status}: ${detail.slice(0, 240)}`)

        if (!retryable || attempt > retries) {
          throw error
        }

        if (typeof onRetry === 'function') {
          onRetry({ attempt, retries, error, status: response.status })
        }

        await sleep(retryDelayMs * attempt)
        continue
      }

      return response.json()
    } catch (error) {
      clearTimeout(timer)

      if (attempt > retries) {
        throw error
      }

      if (typeof onRetry === 'function') {
        onRetry({ attempt, retries, error, status: 0 })
      }

      await sleep(retryDelayMs * attempt)
    }
  }

  throw new Error('fetchJson exhausted retries')
}

export function takeDistinct(rows, keySelector) {
  const seen = new Set()
  const out = []

  for (const row of rows) {
    const key = keySelector(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }

  return out
}

export function toPositiveInt(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}
