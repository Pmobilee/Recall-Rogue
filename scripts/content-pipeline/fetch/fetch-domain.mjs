#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchWikidataBatched, loadQuery } from './wikidata-fetch.mjs'
import { parseCliArgs, readJson, toPositiveInt, writeJson } from './shared-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function normalizeDomainKey(value, sourceDomains) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  if (sourceDomains[raw]) return raw

  const underscored = raw.replaceAll('-', '_')
  if (sourceDomains[underscored]) return underscored

  const hyphenated = raw.replaceAll('_', '-')
  if (sourceDomains[hyphenated]) return hyphenated

  return raw
}

async function main() {
  const args = parseCliArgs(process.argv, {
    domain: '',
    out: '',
    target: 1000,
    'page-size': 500,
    'max-pages': 30,
  })

  if (!args.domain) {
    throw new Error('Usage: node fetch-domain.mjs --domain <domain_key> [--out <file>]')
  }

  const sources = await readJson(path.join(root, 'scripts/content-pipeline/sources.json'))
  const domainKey = normalizeDomainKey(args.domain, sources.domains)
  const domainConfig = sources.domains[domainKey]

  if (!domainConfig) {
    const known = Object.keys(sources.domains).sort().join(', ')
    throw new Error(`Unknown domain: ${args.domain}. Known domains: ${known}`)
  }

  const queryFile = path.join(root, domainConfig.queryFile)
  const outPath = args.out
    ? path.resolve(root, String(args.out))
    : path.join(root, 'data/raw', `${domainKey}.json`)

  const query = await loadQuery(queryFile)
  const rows = await fetchWikidataBatched({
    query,
    targetCount: toPositiveInt(args.target, domainConfig.expectedMinimum ?? 1000),
    pageSize: toPositiveInt(args['page-size'], 500),
    maxPages: toPositiveInt(args['max-pages'], 30),
  })

  await writeJson(outPath, rows)

  const expected = Number(domainConfig.expectedMinimum ?? 0)
  const minimumPolicy = domainConfig.minimumPolicy ?? 'strict'

  console.log(JSON.stringify({
    domain: domainKey,
    rows: rows.length,
    expectedMinimum: expected,
    minimumPolicy,
    meetsMinimum: rows.length >= expected,
    out: outPath,
  }, null, 2))
}

main().catch((error) => {
  console.error('[fetch-domain] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
