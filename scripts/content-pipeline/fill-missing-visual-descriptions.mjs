#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs, readJson, writeJson } from './qa/shared.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '../..')

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function isFactLike(row) {
  return row && typeof row === 'object'
    && normalizeText(row.statement).length > 0
    && normalizeText(row.quizQuestion).length > 0
    && normalizeText(row.correctAnswer).length > 0
}

function buildVisualDescription(fact) {
  const statement = normalizeText(fact.statement)
  const answer = normalizeText(fact.correctAnswer)
  const categoryRaw = Array.isArray(fact.category) ? fact.category[0] : fact.category
  const category = normalizeText(categoryRaw || fact.categoryL1 || 'knowledge')
  return [
    'Pixel-art scene showing',
    statement || 'an educational fact',
    `with the key answer "${answer || 'unknown'}"`,
    'presented through clear foreground action,',
    `${category.toLowerCase()} themed props,`,
    'and a vivid readable composition for card art.',
  ].join(' ')
}

async function listFiles(dirPath, exts) {
  const out = []
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        out.push(...await listFiles(full, exts))
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        out.push(full)
      }
    }
  } catch {
    // ignore missing directories
  }
  return out
}

async function patchJsonl(filePath, dryRun) {
  const raw = await fs.readFile(filePath, 'utf8')
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean)
  const updated = []
  let patched = 0
  let scanned = 0

  for (const line of lines) {
    let row
    try {
      row = JSON.parse(line)
    } catch {
      updated.push(line)
      continue
    }
    if (!isFactLike(row)) {
      updated.push(JSON.stringify(row))
      continue
    }
    scanned += 1
    const hasVisual = normalizeText(row.visualDescription).length > 0
    if (!hasVisual) {
      row.visualDescription = buildVisualDescription(row)
      patched += 1
    }
    updated.push(JSON.stringify(row))
  }

  if (!dryRun && patched > 0) {
    await fs.writeFile(filePath, `${updated.join('\n')}\n`, 'utf8')
  }

  return { filePath, kind: 'jsonl', scanned, patched }
}

async function patchJsonArray(filePath, dryRun) {
  const payload = await readJson(filePath)
  if (!Array.isArray(payload)) {
    return { filePath, kind: 'json', scanned: 0, patched: 0 }
  }

  let scanned = 0
  let patched = 0
  const next = payload.map((row) => {
    if (!isFactLike(row)) return row
    scanned += 1
    const hasVisual = normalizeText(row.visualDescription).length > 0
    if (hasVisual) return row
    patched += 1
    return {
      ...row,
      visualDescription: buildVisualDescription(row),
    }
  })

  if (!dryRun && patched > 0) {
    await writeJson(filePath, next)
  }

  return { filePath, kind: 'json', scanned, patched }
}

async function main() {
  const args = parseArgs(process.argv, {
    'generated-dir': 'data/generated',
    'seed-dir': 'src/data/seed',
    output: 'data/generated/qa-reports/visual-description-fill-report.json',
    'include-generated': true,
    'include-seed': true,
    'dry-run': false,
  })

  const generatedDir = path.resolve(root, String(args['generated-dir']))
  const seedDir = path.resolve(root, String(args['seed-dir']))
  const outputPath = path.resolve(root, String(args.output))
  const includeGenerated = Boolean(args['include-generated'])
  const includeSeed = Boolean(args['include-seed'])
  const dryRun = Boolean(args['dry-run'])

  const results = []

  if (includeGenerated) {
    const jsonlFiles = await listFiles(generatedDir, ['.jsonl'])
    for (const filePath of jsonlFiles) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await patchJsonl(filePath, dryRun))
    }
  }

  if (includeSeed) {
    const jsonFiles = await listFiles(seedDir, ['.json'])
    for (const filePath of jsonFiles) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await patchJsonArray(filePath, dryRun))
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun,
    includeGenerated,
    includeSeed,
    totals: {
      files: results.length,
      scannedFacts: results.reduce((sum, item) => sum + item.scanned, 0),
      patchedFacts: results.reduce((sum, item) => sum + item.patched, 0),
    },
    results: results.map((item) => ({
      filePath: path.relative(root, item.filePath),
      kind: item.kind,
      scanned: item.scanned,
      patched: item.patched,
    })),
  }

  await writeJson(outputPath, summary)
  console.log(JSON.stringify({
    ok: true,
    outputPath,
    patchedFacts: summary.totals.patchedFacts,
    scannedFacts: summary.totals.scannedFacts,
    dryRun,
  }, null, 2))
}

main().catch((error) => {
  console.error('[fill-missing-visual-descriptions] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
