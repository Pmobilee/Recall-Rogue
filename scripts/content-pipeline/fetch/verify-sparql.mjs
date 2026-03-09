#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchWikidataBatched, loadQuery } from './wikidata-fetch.mjs'
import { readJson, toPositiveInt, writeJson } from './shared-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function statusFor(rows, expectedMinimum, minimumPolicy) {
  const meetsMinimum = rows >= expectedMinimum
  if (meetsMinimum) return { ok: true, level: 'pass', reason: 'meets_minimum' }
  if (minimumPolicy === 'advisory') {
    return { ok: true, level: 'warn', reason: 'below_advisory_minimum' }
  }
  return { ok: false, level: 'fail', reason: 'below_strict_minimum' }
}

async function main() {
  const sourcesPath = path.join(root, 'scripts/content-pipeline/sources.json')
  const sources = await readJson(sourcesPath)

  const report = []
  let hasFailure = false

  for (const [domain, config] of Object.entries(sources.domains)) {
    try {
      const queryFile = path.join(root, config.queryFile)
      const query = await loadQuery(queryFile)
      const expectedMinimum = toPositiveInt(config.expectedMinimum, 1)
      const minimumPolicy = config.minimumPolicy === 'advisory' ? 'advisory' : 'strict'

      const rows = await fetchWikidataBatched({
        query,
        targetCount: expectedMinimum,
        pageSize: 200,
        maxPages: 80,
      })

      const status = statusFor(rows.length, expectedMinimum, minimumPolicy)
      if (!status.ok) hasFailure = true

      report.push({
        domain,
        rows: rows.length,
        expectedMinimum,
        minimumPolicy,
        status: status.level,
        reason: status.reason,
        ok: status.ok,
      })

      const prefix = status.level === 'pass' ? 'OK' : status.level === 'warn' ? 'WARN' : 'FAIL'
      console.log(`${prefix} ${domain}: ${rows.length}/${expectedMinimum} (${minimumPolicy})`)
    } catch (error) {
      const minimumPolicy = config.minimumPolicy === 'advisory' ? 'advisory' : 'strict'
      const advisoryPass = minimumPolicy === 'advisory'
      if (!advisoryPass) hasFailure = true
      report.push({
        domain,
        rows: 0,
        expectedMinimum: toPositiveInt(config.expectedMinimum, 1),
        minimumPolicy,
        status: advisoryPass ? 'warn' : 'fail',
        reason: advisoryPass ? 'query_error_advisory' : 'query_error',
        ok: advisoryPass,
        error: error instanceof Error ? error.message : String(error),
      })
      const prefix = advisoryPass ? 'WARN' : 'FAIL'
      console.log(`${prefix} ${domain}: query_error`)
    }
  }

  const outPath = path.join(root, 'data/generated/qa-reports', `sparql-verify-${new Date().toISOString().slice(0, 10)}.json`)
  await writeJson(outPath, {
    generatedAt: new Date().toISOString(),
    hasFailure,
    results: report,
  })

  console.log(`Report written to ${outPath}`)

  if (hasFailure) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[verify-sparql] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
