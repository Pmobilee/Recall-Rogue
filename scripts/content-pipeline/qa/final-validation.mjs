#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson } from './shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function main() {
  const args = parseArgs(process.argv, {
    coverage: 'data/generated/qa-reports/coverage-report.json',
    dedup: 'data/generated/qa-reports/cross-domain-dedup.json',
    migration: 'data/generated/qa-reports/migration-report.json',
  })

  const coveragePath = path.resolve(root, String(args.coverage))
  const dedupPath = path.resolve(root, String(args.dedup))
  const migrationPath = path.resolve(root, String(args.migration))

  const checks = {
    coverageReport: await exists(coveragePath),
    dedupReport: await exists(dedupPath),
    migrationReport: await exists(migrationPath),
  }

  const result = {
    generatedAt: new Date().toISOString(),
    checks,
    pass: Object.values(checks).every(Boolean),
    totals: {
      migratedFacts: checks.migrationReport ? (await readJson(migrationPath)).totalFacts ?? 0 : 0,
      duplicates: checks.dedupReport ? (await readJson(dedupPath)).duplicates ?? 0 : 0,
    },
  }

  console.log(JSON.stringify(result, null, 2))

  if (!result.pass) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error('[final-validation] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
