import fs from 'node:fs/promises'
import { fetchJson, sleep, takeDistinct } from './shared-utils.mjs'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const DEFAULT_USER_AGENT = 'terra-miner-content-pipeline/1.0 (+https://github.com/terra-miner)'

function withTemplate(query, limit, offset) {
  return query
    .replaceAll('{{LIMIT}}', String(limit))
    .replaceAll('{{OFFSET}}', String(offset))
}

export async function loadQuery(queryFile) {
  return fs.readFile(queryFile, 'utf8')
}

export async function runWikidataPage({
  query,
  limit = 500,
  offset = 0,
  userAgent = DEFAULT_USER_AGENT,
  retries = 3,
  timeoutMs = 45_000,
}) {
  const body = new URLSearchParams({ query: withTemplate(query, limit, offset), format: 'json' })

  const payload = await fetchJson(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      accept: 'application/sparql-results+json',
      'user-agent': userAgent,
    },
    body,
    retries,
    timeoutMs,
    onRetry: ({ attempt, error, status }) => {
      const code = status > 0 ? `status=${status}` : 'network/timeout'
      console.warn(`[wikidata] retry ${attempt}/${retries} (${code}) at offset=${offset}: ${error instanceof Error ? error.message : String(error)}`)
    },
  })

  return payload?.results?.bindings ?? []
}

export function normalizeBinding(binding) {
  const out = {}
  for (const [key, value] of Object.entries(binding)) {
    out[key] = value?.value ?? null
  }
  return out
}

function rowIdentity(row) {
  const preferredKeys = [
    'item',
    'entity',
    'country',
    'species',
    'event',
    'deity',
    'body',
    'mission',
    'artist',
    'work',
    'id',
  ]

  for (const key of preferredKeys) {
    if (typeof row[key] === 'string' && row[key].length > 0) {
      return `${key}:${row[key]}`
    }
  }

  return JSON.stringify(row)
}

export async function fetchWikidataBatched({
  query,
  targetCount = 1000,
  pageSize = 500,
  maxPages = 30,
  pageDelayMs = 200,
}) {
  const rows = []

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize
    const batch = await runWikidataPage({ query, limit: pageSize, offset })
    if (batch.length === 0) break

    const normalized = takeDistinct(batch.map((binding) => normalizeBinding(binding)), rowIdentity)
    rows.push(...normalized)

    if (rows.length >= targetCount) break
    if (pageDelayMs > 0) await sleep(pageDelayMs)
  }

  return takeDistinct(rows, rowIdentity)
}
