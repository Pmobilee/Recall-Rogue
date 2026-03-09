#!/usr/bin/env node
import path from 'node:path'
import { fetchJson, parseCliArgs, toPositiveInt, writeJson } from './shared-utils.mjs'

async function main() {
  const args = parseCliArgs(process.argv, {
    limit: 1000,
    output: 'data/raw/gbif-species.json',
  })

  const target = Math.min(10_000, toPositiveInt(args.limit, 1000))
  const pageSize = Math.min(300, target)

  const rows = []
  for (let offset = 0; offset < target; offset += pageSize) {
    const remaining = target - rows.length
    if (remaining <= 0) break

    const limit = Math.min(pageSize, remaining)
    const url = `https://api.gbif.org/v1/species/search?rank=SPECIES&status=ACCEPTED&limit=${limit}&offset=${offset}`
    const payload = await fetchJson(url, { retries: 2 })
    const batch = Array.isArray(payload?.results) ? payload.results : []
    if (batch.length === 0) break

    rows.push(...batch.map((item) => ({
      key: item.key ?? null,
      scientificName: item.scientificName ?? null,
      canonicalName: item.canonicalName ?? null,
      kingdom: item.kingdom ?? null,
      phylum: item.phylum ?? null,
      class: item.class ?? null,
      order: item.order ?? null,
      family: item.family ?? null,
      genus: item.genus ?? null,
      sourceName: 'GBIF',
      sourceUrl: item.key ? `https://www.gbif.org/species/${item.key}` : null,
    })))
  }

  const outPath = path.resolve(String(args.output))
  await writeJson(outPath, rows)
  console.log(`wrote ${rows.length} GBIF species rows to ${outPath}`)
}

main().catch((error) => {
  console.error('[fetch-gbif] failed:', error instanceof Error ? error.message : error)
  process.exit(1)
})
