#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, readJson, writeJson, toPositiveInt } from '../fetch/shared-utils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../../..')

function toDomainKey(value) {
  return String(value || '').trim().replaceAll('-', '_')
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stableHash(input) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickIdentity(row, index) {
  return String(
    row?.id
    ?? row?.item
    ?? row?.entity
    ?? row?.species
    ?? row?.country
    ?? row?.objectID
    ?? row?.cid
    ?? row?.key
    ?? row?.name
    ?? row?.title
    ?? row?.itemLabel
    ?? row?.entityLabel
    ?? `row-${index}`,
  )
}

function canonicalKey(row, index) {
  const label = row?.itemLabel
    ?? row?.entityLabel
    ?? row?.speciesLabel
    ?? row?.countryLabel
    ?? row?.canonicalName
    ?? row?.name
    ?? row?.title
    ?? row?.itemDescription
    ?? row?.description
    ?? ''

  return `${normalizeText(pickIdentity(row, index))}::${normalizeText(label)}`
}

function normalizeSourceDataset(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function loadRows(filePath) {
  const absolutePath = path.resolve(root, filePath)
  const payload = await readJson(absolutePath)
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.facts)) return payload.facts
  return []
}

function deterministicTake(rows, takeCount, seed, label) {
  if (!Array.isArray(rows) || rows.length === 0 || takeCount <= 0) return []
  if (takeCount >= rows.length) return [...rows]

  return rows
    .map((row, index) => {
      const id = pickIdentity(row, index)
      const score = stableHash(`${seed}|${label}|${id}|${index}`)
      return { row, score }
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, takeCount)
    .map((entry) => entry.row)
}

function deterministicOrder(rows, seed, label) {
  return rows
    .map((row, index) => {
      const id = pickIdentity(row, index)
      const score = stableHash(`order|${seed}|${label}|${id}|${index}`)
      return { row, score }
    })
    .sort((a, b) => a.score - b.score)
    .map((entry) => entry.row)
}

function computeSupplementTargets({
  supplements,
  availableByPath,
  primaryCount,
  totalTarget,
  defaultSupplementWeight,
}) {
  const withWeights = supplements.map((supplement) => ({
    ...supplement,
    weight: Math.max(0, Number(supplement?.weight ?? defaultSupplementWeight)),
  }))

  if (totalTarget > 0) {
    const remaining = Math.max(0, totalTarget - primaryCount)
    if (remaining === 0 || withWeights.length === 0) {
      return withWeights.map((supplement) => ({ ...supplement, target: 0 }))
    }

    const totalWeight = withWeights.reduce((sum, item) => sum + item.weight, 0)
    if (totalWeight <= 0) {
      const even = Math.floor(remaining / withWeights.length)
      let remainder = remaining - even * withWeights.length
      return withWeights.map((supplement) => {
        const target = even + (remainder > 0 ? 1 : 0)
        remainder = Math.max(0, remainder - 1)
        return { ...supplement, target }
      })
    }

    let allocated = 0
    const withInitial = withWeights.map((supplement) => {
      const rawTarget = Math.floor((remaining * supplement.weight) / totalWeight)
      allocated += rawTarget
      return {
        ...supplement,
        target: rawTarget,
        fractional: ((remaining * supplement.weight) / totalWeight) - rawTarget,
      }
    })

    let leftover = remaining - allocated
    const byFraction = [...withInitial].sort((a, b) => b.fractional - a.fractional)
    for (const supplement of byFraction) {
      if (leftover <= 0) break
      supplement.target += 1
      leftover -= 1
    }

    return withInitial.map((supplement) => {
      const available = availableByPath.get(supplement.path) ?? 0
      return {
        ...supplement,
        target: Math.max(0, Math.min(available, supplement.target)),
      }
    })
  }

  return withWeights.map((supplement) => {
    const available = availableByPath.get(supplement.path) ?? 0
    const target = Math.round(primaryCount * supplement.weight)
    return {
      ...supplement,
      target: Math.max(0, Math.min(available, target)),
    }
  })
}

function annotateRows(rows, { domain, sourcePath, sourceRole }) {
  const sourceDataset = normalizeSourceDataset(sourcePath)
  return rows.map((row) => ({
    ...row,
    sourceDataset: row?.sourceDataset || sourceDataset,
    sourceMix: {
      domain,
      sourcePath,
      sourceRole,
    },
  }))
}

async function main() {
  const args = parseCliArgs(process.argv, {
    domains: '',
    config: 'scripts/content-pipeline/sources.json',
    'output-dir': 'data/raw/mixed',
    report: 'data/generated/qa-reports/source-mix-report.json',
    target: 0,
    seed: 'source-mix-v1',
    strict: false,
    verbose: false,
  })

  const configPath = path.resolve(root, String(args.config))
  const outputDir = path.resolve(root, String(args['output-dir']))
  const reportPath = path.resolve(root, String(args.report))
  const target = Math.max(0, toPositiveInt(args.target, 0))
  const seed = String(args.seed || 'source-mix-v1')
  const strict = Boolean(args.strict)
  const verbose = Boolean(args.verbose)

  const config = await readJson(configPath)
  const sourceMix = config?.sourceMix?.domains

  if (!sourceMix || typeof sourceMix !== 'object') {
    throw new Error('sources.json missing sourceMix.domains configuration')
  }

  const defaultSupplementWeight = Math.max(0, Number(config?.sourceMix?.defaultSupplementWeight ?? 0.25))

  const requestedDomains = String(args.domains || '')
    .split(',')
    .map((value) => toDomainKey(value))
    .filter(Boolean)

  const domains = requestedDomains.length > 0
    ? requestedDomains
    : Object.keys(sourceMix)

  await fs.mkdir(outputDir, { recursive: true })

  const report = {
    generatedAt: new Date().toISOString(),
    configPath,
    outputDir,
    reportPath,
    targetPerDomain: target || null,
    seed,
    strict,
    domains: [],
    totals: {
      domainsRequested: domains.length,
      domainsProcessed: 0,
      rowsWritten: 0,
      duplicatesDropped: 0,
      missingInputs: 0,
    },
    pass: true,
  }

  for (const domain of domains) {
    const domainConfig = sourceMix[domain]
    if (!domainConfig) {
      const error = `domain '${domain}' not present in sourceMix config`
      report.domains.push({ domain, error, pass: false })
      report.totals.missingInputs += 1
      report.pass = false
      if (strict) break
      continue
    }

    const primaryPath = String(domainConfig.primary || '').trim()
    const supplementDefs = Array.isArray(domainConfig.supplements) ? domainConfig.supplements : []

    if (!primaryPath) {
      const error = `domain '${domain}' has no primary source path`
      report.domains.push({ domain, error, pass: false })
      report.totals.missingInputs += 1
      report.pass = false
      if (strict) break
      continue
    }

    const domainReport = {
      domain,
      pass: true,
      primary: {
        path: primaryPath,
        available: 0,
        selected: 0,
      },
      supplements: [],
      outputPath: path.join(outputDir, `${domain}.json`),
      outputCount: 0,
      duplicatesDropped: 0,
    }

    const primaryAbs = path.resolve(root, primaryPath)
    if (!(await exists(primaryAbs))) {
      domainReport.pass = false
      domainReport.error = `missing primary input: ${primaryPath}`
      report.totals.missingInputs += 1
      report.pass = false
      report.domains.push(domainReport)
      if (strict) break
      continue
    }

    const primaryRows = await loadRows(primaryPath)
    domainReport.primary.available = primaryRows.length

    const selectedPrimaryCount = target > 0
      ? Math.min(target, primaryRows.length)
      : primaryRows.length

    const selectedPrimary = annotateRows(
      deterministicTake(primaryRows, selectedPrimaryCount, seed, `${domain}:primary`),
      { domain, sourcePath: primaryPath, sourceRole: 'primary' },
    )
    domainReport.primary.selected = selectedPrimary.length

    const availableByPath = new Map()
    const supplementRowsByPath = new Map()

    for (const supplement of supplementDefs) {
      const supplementPath = String(supplement?.path || '').trim()
      if (!supplementPath) continue

      const supplementAbs = path.resolve(root, supplementPath)
      if (!(await exists(supplementAbs))) {
        availableByPath.set(supplementPath, 0)
        supplementRowsByPath.set(supplementPath, [])
        domainReport.supplements.push({
          path: supplementPath,
          weight: Math.max(0, Number(supplement?.weight ?? defaultSupplementWeight)),
          available: 0,
          selected: 0,
          missing: true,
        })
        report.totals.missingInputs += 1
        report.pass = false
        if (strict) {
          domainReport.pass = false
          break
        }
        continue
      }

      const rows = await loadRows(supplementPath)
      availableByPath.set(supplementPath, rows.length)
      supplementRowsByPath.set(supplementPath, rows)
    }

    if (!domainReport.pass && strict) {
      report.domains.push(domainReport)
      break
    }

    const supplementTargets = computeSupplementTargets({
      supplements: supplementDefs,
      availableByPath,
      primaryCount: selectedPrimary.length,
      totalTarget: target,
      defaultSupplementWeight,
    })

    const selectedSupplementRows = []

    for (const supplement of supplementTargets) {
      const supplementPath = String(supplement.path || '').trim()
      if (!supplementPath) continue

      const available = availableByPath.get(supplementPath) ?? 0
      const rows = supplementRowsByPath.get(supplementPath) ?? []
      const selected = annotateRows(
        deterministicTake(rows, supplement.target, seed, `${domain}:${supplementPath}`),
        { domain, sourcePath: supplementPath, sourceRole: 'supplement' },
      )

      selectedSupplementRows.push(...selected)

      const existing = domainReport.supplements.find((item) => item.path === supplementPath)
      if (existing) {
        existing.available = available
        existing.selected = selected.length
        existing.missing = false
      } else {
        domainReport.supplements.push({
          path: supplementPath,
          weight: supplement.weight,
          available,
          selected: selected.length,
          missing: false,
        })
      }
    }

    const merged = deterministicOrder(
      [...selectedPrimary, ...selectedSupplementRows],
      seed,
      `${domain}:final`,
    )

    const deduped = []
    const seen = new Set()

    for (let i = 0; i < merged.length; i += 1) {
      const row = merged[i]
      const key = canonicalKey(row, i)
      if (seen.has(key)) {
        domainReport.duplicatesDropped += 1
        continue
      }
      seen.add(key)
      deduped.push(row)
    }

    domainReport.outputCount = deduped.length

    await writeJson(domainReport.outputPath, deduped)

    if (verbose) {
      console.log(`[source-mix] ${domain} primary=${domainReport.primary.selected} supplements=${selectedSupplementRows.length} output=${domainReport.outputCount}`)
    }

    report.domains.push(domainReport)
    report.totals.domainsProcessed += 1
    report.totals.rowsWritten += domainReport.outputCount
    report.totals.duplicatesDropped += domainReport.duplicatesDropped

    if (!domainReport.pass) {
      report.pass = false
    }
  }

  await writeJson(reportPath, report)
  console.log(JSON.stringify({
    ok: report.pass,
    reportPath,
    outputDir,
    domainsProcessed: report.totals.domainsProcessed,
    rowsWritten: report.totals.rowsWritten,
    duplicatesDropped: report.totals.duplicatesDropped,
    missingInputs: report.totals.missingInputs,
  }, null, 2))

  if (!report.pass && strict) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[source-mix] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
